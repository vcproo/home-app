"""Local HTTPS API. Run with python -m server.app after tools/setup-local-tls.py."""
from collections import defaultdict, deque
from pathlib import Path
import hashlib
import json
import logging
import os
import threading
import time
import pymysql
from flask import Flask, request, jsonify, g, send_from_directory
from werkzeug.exceptions import HTTPException
from domain.rules import DomainError
from store.mysql_store import connect, HomeStore
from server import database as db
import base64
import io
import secrets
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
app=Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH']=4*1024*1024
attempts=defaultdict(deque)
rate_lock=threading.Lock()

@app.before_request
def prepare():
    if request.path.startswith('/api/'):
        g.conn=connect()
        if request.path not in ('/api/auth/login','/api/auth/register','/api/health'):
            auth=request.headers.get('Authorization','')
            g.uid=db.identify(g.conn,auth[7:] if auth.startswith('Bearer ') else '')

@app.teardown_request
def close(_error):
    conn=g.pop('conn',None)
    if conn:
        conn.rollback();conn.close()

@app.after_request
def headers(response):
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    return response

@app.errorhandler(Exception)
def error(exc):
    if isinstance(exc,db.ApiError):return jsonify(error=str(exc)),exc.status
    if isinstance(exc,DomainError):return jsonify(error=exc.message),400
    if isinstance(exc,HTTPException):return jsonify(error='请求格式或大小不正确'),exc.code
    if isinstance(exc,pymysql.err.IntegrityError):return jsonify(error='记录已存在，请检查手机号或重新加载'),409
    if isinstance(exc,pymysql.err.OperationalError):return jsonify(error='数据库暂时不可用，请稍后重试'),503
    # Do not log SQL statements, payloads, passwords or request headers.
    app.logger.error('Request failed: %s',type(exc).__name__)
    return jsonify(error='服务暂时无法处理请求'),500

def body():
    value=request.get_json()
    if not isinstance(value,dict):raise db.ApiError('请求应为JSON对象')
    return value

def throttle():
    key=request.remote_addr or 'local'
    now=time.monotonic()
    with rate_lock:
        q=attempts[key]
        while q and q[0]<now-60:q.popleft()
        if len(q)>=20:raise db.ApiError('操作过于频繁，请一分钟后重试',429)
        q.append(now)

@app.get('/api/health')
def health():
    with g.conn.cursor() as cur:cur.execute('SELECT 1')
    return jsonify(ok=True,storage='mysql',version='1.5.4')

@app.post('/api/auth/<action>')
def auth(action):
    if action not in ('login','register'):raise db.ApiError('无效操作',404)
    throttle();value=body();store=HomeStore(g.conn)
    phone=value.get('phone');password=value.get('password')
    if not isinstance(phone,str) or not isinstance(password,str):raise db.ApiError('请填写手机号和密码')
    if action=='register':uid=store.register(phone,password)
    else:
        try:uid=store.login(phone,password)
        except DomainError:raise db.ApiError('手机号或密码错误',401)
    return jsonify(db.session(g.conn,uid))

@app.post('/api/logout')
def logout():
    token=request.headers['Authorization'][7:]
    with g.conn.cursor() as cur:cur.execute('DELETE FROM app_sessions WHERE token_hash=%s',(hashlib.sha256(token.encode()).hexdigest(),))
    g.conn.commit();return jsonify(ok=True)

@app.get('/api/data')
def load():return jsonify(db.read_data(g.conn,g.uid))

@app.post('/api/address-photos')
def upload_address_photo():
    value=body().get('image','')
    if not isinstance(value,str) or not value.startswith(('data:image/jpeg;base64,','data:image/png;base64,','data:image/webp;base64,')):raise db.ApiError('请选择 JPG、PNG 或 WebP 图片')
    try:
        raw=base64.b64decode(value.split(',',1)[1],validate=True)
        if len(raw)>3*1024*1024:raise ValueError()
        with Image.open(io.BytesIO(raw)) as original:
            if original.width*original.height>24000000:raise ValueError()
            original.load();picture=ImageOps.exif_transpose(original).convert('RGB');picture.thumbnail((1280,1280))
            out=io.BytesIO();picture.save(out,'JPEG',quality=82);encoded=out.getvalue()
    except Exception:raise db.ApiError('图片无法读取或过大，请换一张图片')
    member=db.membership(g.conn,g.uid,True)
    with g.conn.cursor() as cur:
        # Bound storage for abandoned uploads; never remove photos still in address records.
        cur.execute('SELECT payload FROM app_family_data WHERE family_id=%s FOR UPDATE',(member['familyId'],))
        family=json.loads(cur.fetchone()[0]);used={p for a in family.get('addresses',[]) for p in a.get('photos',[])} | {v[3] for v in family.get('categoryLooks',{}).values() if len(v)==4}
        cur.execute('SELECT id FROM app_address_photos WHERE family_id=%s AND created_at<UTC_TIMESTAMP()-INTERVAL 7 DAY',(member['familyId'],))
        for row in cur.fetchall():
            if row[0] not in used:cur.execute('DELETE FROM app_address_photos WHERE id=%s',(row[0],))
        cur.execute('SELECT COALESCE(SUM(OCTET_LENGTH(image)),0) FROM app_address_photos WHERE family_id=%s',(member['familyId'],))
        if cur.fetchone()[0]+len(encoded)>200*1024*1024:raise db.ApiError('家庭图片存储已达200MB，请先移除不需要的图片')
        photo_id=secrets.token_hex(16)
        cur.execute('INSERT INTO app_address_photos(id,family_id,image) VALUES(%s,%s,%s)',(photo_id,member['familyId'],encoded))
    g.conn.commit()
    return jsonify(id=photo_id,image='data:image/jpeg;base64,'+base64.b64encode(encoded).decode())

@app.get('/api/address-photos/<photo_id>')
def read_address_photo(photo_id):
    member=db.membership(g.conn,g.uid)
    with g.conn.cursor() as cur:
        cur.execute('SELECT image FROM app_address_photos WHERE id=%s AND family_id=%s',(photo_id,member['familyId']));row=cur.fetchone()
    if not row:raise db.ApiError('图片不存在或无权访问',404)
    return jsonify(image='data:image/jpeg;base64,'+base64.b64encode(row[0]).decode())

@app.put('/api/data')
def save():return jsonify(db.write_data(g.conn,g.uid,body()))

@app.post('/api/family/invite')
def refresh():return jsonify(db.refresh_invite(g.conn,g.uid))

@app.post('/api/family/join')
def join():
    code=body().get('code','')
    if not isinstance(code,str):raise db.ApiError('邀请码格式无效')
    return jsonify(db.join_family(g.conn,g.uid,code.strip().upper()))

@app.post('/api/legacy-backup')
def backup():
    value=body();db.validate_tree(value)
    allowed=set(db.FAMILY_KEYS+db.PERSONAL_KEYS+('version','members','invite','retiredInvites','exportedAt'))
    if set(value)-allowed:raise db.ApiError('旧备份格式无效')
    with g.conn.cursor() as cur:
        cur.execute('INSERT INTO app_legacy_backups(user_id,payload) VALUES(%s,%s) ON DUPLICATE KEY UPDATE user_id=user_id',(g.uid,db.dumps(value)))
    g.conn.commit();return jsonify(ok=True)

@app.get('/api/legacy-backup')
def get_backup():
    with g.conn.cursor() as cur:
        cur.execute('SELECT payload FROM app_legacy_backups WHERE user_id=%s',(g.uid,));row=cur.fetchone()
    if not row:raise db.ApiError('没有旧数据备份',404)
    return jsonify(json.loads(row[0]))

@app.get('/')
def index():return send_from_directory(ROOT/'web','index.html')

@app.get('/<path:path>')
def asset(path):return send_from_directory(ROOT/'web',path)

def main():
    from werkzeug.serving import make_server
    db.schema()
    directory=ROOT/'.local-server'
    # Loopback only: use adb reverse for the Android emulator. Never expose debug HTTP.
    server=make_server('127.0.0.1',8787,app,threaded=True,ssl_context=(str(directory/'server.crt'),str(directory/'server.key')))
    print('Home app HTTPS + MySQL ready at https://localhost:8787',flush=True)
    server.serve_forever()

if __name__=='__main__':main()
