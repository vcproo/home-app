"""Authenticated MySQL persistence. Family and personal revisions are independent."""
import copy
import hashlib
import json
import math
import re
import secrets
from datetime import datetime, timedelta, timezone
from store.mysql_store import connect, HomeStore

FAMILY_KEYS = ('ledger', 'renqing', 'accounts', 'categories', 'houses', 'addresses', 'categoryLooks')
PERSONAL_KEYS = ('health', 'preferences')

class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status

def dumps(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':'))

def empty_family():
    return dict(ledger=[], renqing=[], accounts=[], houses=[], addresses=[],
                categories={'expense': ['餐饮', '交通', '购物', '住房', '其他'], 'income': ['工资', '奖金', '其他']}, categoryLooks={})

def empty_personal():
    return {'health': [dict(sex='', age=None, height=None, weight=None, delta=0, records=[], meals=[], deletedMeals=[])], 'preferences': {}}

def schema():
    conn = connect()
    try:
        HomeStore(conn).ensure_schema()
        with conn.cursor() as cur:
            for sql in [
                '''CREATE TABLE IF NOT EXISTS app_address_photos (
                    id CHAR(32) PRIMARY KEY, family_id INT NOT NULL, image MEDIUMBLOB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(family_id)) ENGINE=InnoDB''',
                '''CREATE TABLE IF NOT EXISTS app_sessions (
                    token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL,
                    expires_at DATETIME NOT NULL, INDEX(user_id)) ENGINE=InnoDB''',
                '''CREATE TABLE IF NOT EXISTS app_family_data (
                    family_id INT PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0,
                    payload JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB''',
                '''CREATE TABLE IF NOT EXISTS app_personal_data (
                    user_id INT PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0,
                    payload JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB''',
                '''CREATE TABLE IF NOT EXISTS app_write_receipts (
                    user_id INT NOT NULL, request_id VARCHAR(80) NOT NULL, body_hash CHAR(64) NOT NULL,
                    response JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(user_id,request_id)) ENGINE=InnoDB''',
                '''CREATE TABLE IF NOT EXISTS app_legacy_backups (
                    user_id INT PRIMARY KEY, payload JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB''',
            ]:
                cur.execute(sql)
        conn.commit()
    finally:
        conn.close()

def identify(conn, token):
    if not token or len(token) > 200:
        raise ApiError('请先登录', 401)
    with conn.cursor() as cur:
        cur.execute('SELECT user_id FROM app_sessions WHERE token_hash=%s AND expires_at>UTC_TIMESTAMP()', (hashlib.sha256(token.encode()).hexdigest(),))
        row = cur.fetchone()
    if not row:
        raise ApiError('登录已过期，请重新登录', 401)
    return row[0]

def membership(conn, uid, lock=False):
    with conn.cursor() as cur:
        cur.execute('SELECT id,family_id,role,display_name FROM members WHERE user_id=%s ORDER BY id LIMIT 1' + (' FOR UPDATE' if lock else ''), (uid,))
        row = cur.fetchone()
    if not row:
        raise ApiError('尚未创建家庭', 409)
    return {'memberId': row[0], 'familyId': row[1], 'role': row[2], 'name': row[3]}

def ensure_user(conn, uid):
    # Lock the user row to serialize simultaneous first logins.
    with conn.cursor() as cur:
        cur.execute('SELECT phone,nickname FROM users WHERE id=%s FOR UPDATE', (uid,))
        phone, nickname = cur.fetchone()
        cur.execute('SELECT family_id FROM members WHERE user_id=%s ORDER BY id LIMIT 1', (uid,))
        member = cur.fetchone()
        if member:
            fid = member[0]
            cur.execute('INSERT IGNORE INTO app_family_data(family_id,payload) VALUES(%s,%s)', (fid,dumps(empty_family())))
        cur.execute('INSERT IGNORE INTO app_personal_data(user_id,payload) VALUES(%s,%s)', (uid,dumps(empty_personal())))
    conn.commit()

def session(conn, uid):
    ensure_user(conn, uid)
    token = secrets.token_urlsafe(32)
    with conn.cursor() as cur:
        cur.execute('DELETE FROM app_sessions WHERE expires_at<=UTC_TIMESTAMP()')
        cur.execute('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES(%s,%s,%s)',
                    (hashlib.sha256(token.encode()).hexdigest(),uid,datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=30)))
    conn.commit()
    return {'token':token, **read_data(conn,uid)}

def read_data(conn, uid):
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM members WHERE user_id=%s LIMIT 1', (uid,))
        if not cur.fetchone():
            cur.execute('SELECT revision,payload FROM app_personal_data WHERE user_id=%s', (uid,))
            pr, personal = cur.fetchone()
            return {'user': {'id':uid,'familyId':None}, 'needsFamily':True,
                    'familyRevision':0,'personalRevision':pr,
                    'data':{**empty_family(),**json.loads(personal),'members':[],'invite':'','familyName':''}}
    member = membership(conn,uid)
    with conn.cursor() as cur:
        cur.execute('SELECT revision,payload FROM app_family_data WHERE family_id=%s', (member['familyId'],))
        fr, family = cur.fetchone()
        cur.execute('SELECT revision,payload FROM app_personal_data WHERE user_id=%s', (uid,))
        pr, personal = cur.fetchone()
        cur.execute('SELECT id,display_name,role,user_id FROM members WHERE family_id=%s ORDER BY id', (member['familyId'],))
        members = [{'id':r[0],'name':r[1],'role':'管理员' if r[2]=='admin' else '成员','desc':'我' if r[3]==uid else '家庭成员'} for r in cur.fetchall()]
        cur.execute('SELECT name FROM families WHERE id=%s', (member['familyId'],))
        family_name = cur.fetchone()[0]
        cur.execute('SELECT code FROM invite_codes WHERE family_id=%s AND active=1 ORDER BY id DESC LIMIT 1', (member['familyId'],))
        invite = cur.fetchone()
    return {'user':{'id':uid, **member}, 'familyRevision':fr, 'personalRevision':pr,
            'data':{**json.loads(family), **json.loads(personal), 'members':members,'invite':invite[0] if invite else '', 'familyName':family_name}}

def validate_tree(value, depth=0):
    if depth > 12: raise ApiError('数据层级过深')
    if isinstance(value,dict):
        if len(value)>1000: raise ApiError('数据字段过多')
        for k,v in value.items():
            if k in ('__proto__','prototype','constructor','apiKey','password','token'): raise ApiError('数据含不允许保存的字段')
            validate_tree(v,depth+1)
    elif isinstance(value,list):
        if len(value)>20000: raise ApiError('记录过多，请先归档')
        for v in value:validate_tree(v,depth+1)
    elif isinstance(value,str):
        if len(value)>2000:raise ApiError('文本过长')
    elif isinstance(value,(int,float)) and not isinstance(value,bool):
        if not math.isfinite(value) or abs(value)>10**14:raise ApiError('数字无效')
    elif value is not None and not isinstance(value,bool):raise ApiError('数据格式无效')

def validate_data(data):
    if not isinstance(data,dict) or set(data)!=set(FAMILY_KEYS+PERSONAL_KEYS):raise ApiError('数据字段无效')
    validate_tree(data)
    for k in ('ledger','renqing','accounts','houses','addresses','health'):
        if k not in data or not isinstance(data[k],list):raise ApiError('缺少记录集合：'+k)
    if len(data['health'])!=1 or not isinstance(data['health'][0],dict):raise ApiError('健康资料必须为个人档案')
    if not isinstance(data.get('categories'),dict) or not all(isinstance(data['categories'].get(k),list) for k in ('income','expense')):raise ApiError('分类格式无效')
    if not isinstance(data.get('categoryLooks',{}),dict) or not isinstance(data.get('preferences',{}),dict):raise ApiError('设置格式无效')
    for names in data['categories'].values():
        if not isinstance(names,list) or any(not isinstance(n,str) or not n.strip() or len(n)>40 for n in names):raise ApiError('分类名称无效')
    for look in data['categoryLooks'].values():
        if not isinstance(look,list) or len(look) not in (3,4) or not isinstance(look[0],str) or not re.fullmatch(r'[a-z-]{1,40}',look[0]) or any(not isinstance(c,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?',c) for c in look[1:3]):raise ApiError('分类样式无效')
        if len(look)==4 and (not isinstance(look[3],str) or not re.fullmatch(r'[a-f0-9]{32}',look[3])):raise ApiError('自定义图标编号无效')
    for collection in ('ledger','renqing','accounts','houses','addresses'):
        ids=set()
        for row in data[collection]:
            if not isinstance(row,dict):raise ApiError('记录格式无效')
            key=str(row.get('id',''))
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',key) or key in ids:raise ApiError('记录编号无效或重复')
            ids.add(key)
            for field in ('name','title','day','occurredOn','category','note','member','time','bank','type','last4','hint','reason','status','water','power','gas','detail'):
                if field in row and not isinstance(row[field],str):raise ApiError('记录文本格式无效')
            if collection in ('accounts','houses','addresses','renqing') and not row.get('name','').strip():raise ApiError('记录名称不能为空')
    account_ids={a['id'] for a in data['accounts']}
    for row in data['accounts']:
        if not isinstance(row.get('balance'),(float,int)) or isinstance(row.get('balance'),bool):raise ApiError('账户余额无效')
    for row in data['addresses']:
        photos=row.get('photos',[])
        if not isinstance(photos,list) or len(photos)>9 or len(set(str(p) for p in photos))!=len(photos) or any(not isinstance(p,str) or not re.fullmatch(r'[a-f0-9]{32}',p) for p in photos):raise ApiError('每个地址最多保存9张图片，图片编号不能重复')
    for row in data['ledger']+data['renqing']:
        if not isinstance(row.get('amount'),(float,int)) or isinstance(row['amount'],bool) or not 0<row['amount']<=10**12:raise ApiError('流水金额无效')
        if row.get('accountId') not in account_ids:raise ApiError('流水账户不存在')
    for row in data['ledger']:
        if row.get('kind') not in ('income','expense') or not row.get('category'):raise ApiError('流水分类或收支类型无效')
    for row in data['renqing']:
        if row.get('side') not in ('in','out'):raise ApiError('人情类型无效')
    p=data['health'][0]
    for k in ('sex','activity','goal','name'):
        if k in p and not isinstance(p[k],str):raise ApiError('健康资料格式无效')
    for k in ('age','height','weight','delta','calorieTarget'):
        if p.get(k) is not None and (not isinstance(p[k],(int,float)) or isinstance(p[k],bool)):raise ApiError('健康数值格式无效')
    for k,low,high in [('age',1,120),('height',80,250),('weight',1,500),('calorieTarget',1000,6000)]:
        if p.get(k) is not None and not low<=p[k]<=high:raise ApiError('健康数值超出范围：'+k)
    for k in ('records','meals','deletedMeals'):
        if not isinstance(p.get(k,[]),list):raise ApiError('健康记录格式无效')
    for r in p.get('records',[]):
        if not isinstance(r,dict) or not isinstance(r.get('w'),(int,float)) or not 1<=r['w']<=500 or not isinstance(r.get('day'),str) or not isinstance(r.get('d'),(int,float)):raise ApiError('体重记录无效')
    for m in p.get('meals',[])+p.get('deletedMeals',[]):
        if not isinstance(m,dict) or not isinstance(m.get('calories'),(int,float)) or not 0<m['calories']<=10000 or not str(m.get('name','')).strip():raise ApiError('饮食记录无效')
        try:datetime.strptime(m.get('date',''),'%Y-%m-%d')
        except (ValueError,TypeError):raise ApiError('饮食日期无效')
        for k in ('id','name','mealType','portion','note','source'):
            if k in m and not isinstance(m[k],str):raise ApiError('饮食记录文本无效')

def write_data(conn,uid,body):
    data=body.get('data');validate_data(data)
    request_id=body.get('requestId','')
    if not isinstance(request_id,str) or not re.fullmatch(r'[A-Za-z0-9_-]{10,80}',request_id):raise ApiError('请求编号无效')
    signature=hashlib.sha256(dumps(body).encode()).hexdigest()
    member=membership(conn,uid,True)
    with conn.cursor() as cur:
        cur.execute('SELECT body_hash,response FROM app_write_receipts WHERE user_id=%s AND request_id=%s',(uid,request_id))
        receipt=cur.fetchone()
        if receipt:
            if receipt[0]!=signature:raise ApiError('请求编号已用于其他修改',409)
            conn.commit();return json.loads(receipt[1])
        if body.get('familyId')!=member['familyId']:raise ApiError('家庭已变更，请重新加载',409)
        for photo in ({p for a in data['addresses'] for p in a.get('photos',[])} | {v[3] for v in data['categoryLooks'].values() if len(v)==4}):
            cur.execute('SELECT id FROM app_address_photos WHERE id=%s AND family_id=%s',(photo,member['familyId']))
            if not cur.fetchone():raise ApiError('地址图片不存在或无权访问，请重新上传')
        revisions={}
        for scope,owner,keys in [('family',member['familyId'],FAMILY_KEYS),('personal',uid,PERSONAL_KEYS)]:
            column='family_id' if scope=='family' else 'user_id'
            cur.execute(f'SELECT revision,payload FROM app_{scope}_data WHERE {column}=%s FOR UPDATE',(owner,))
            revision,old=cur.fetchone()
            payload={k:data[k] for k in keys if k in data}
            changed=json.loads(old)!=payload
            if changed and body.get(scope+'Revision')!=revision:raise ApiError('其他设备已更新记录，请保留草稿后加载数据库最新数据',409)
            if changed:
                revision+=1
                cur.execute(f'UPDATE app_{scope}_data SET revision=%s,payload=%s WHERE {column}=%s',(revision,dumps(payload),owner))
            revisions[scope+'Revision']=revision
        cur.execute('INSERT INTO app_write_receipts(user_id,request_id,body_hash,response) VALUES(%s,%s,%s,%s)',(uid,request_id,signature,dumps(revisions)))
    conn.commit();return revisions

def refresh_invite(conn,uid):
    member=membership(conn,uid,True)
    if member['role']!='admin':raise ApiError('只有管理员可以刷新邀请码',403)
    with conn.cursor() as cur:
        cur.execute('UPDATE invite_codes SET active=0 WHERE family_id=%s',(member['familyId'],))
        code=secrets.token_hex(3).upper()
        cur.execute('INSERT INTO invite_codes(family_id,code,active,created_at) VALUES(%s,%s,1,UTC_TIMESTAMP())',(member['familyId'],code))
    conn.commit();return {'invite':code}

def create_family(conn,uid,name):
    if not isinstance(name,str) or not 1<=len(name.strip())<=40:
        raise ApiError('请填写1至40字的家庭名称')
    with conn.cursor() as cur:
        cur.execute('SELECT phone,nickname FROM users WHERE id=%s FOR UPDATE',(uid,))
        phone,nickname=cur.fetchone()
        cur.execute('SELECT id FROM members WHERE user_id=%s LIMIT 1 FOR UPDATE',(uid,))
        if cur.fetchone():raise ApiError('你已有家庭，请勿重复创建',409)
        cur.execute('INSERT INTO families(name,member_limit) VALUES(%s,8)',(name.strip(),))
        fid=cur.lastrowid
        cur.execute("INSERT INTO members(family_id,user_id,role,display_name) VALUES(%s,%s,'admin',%s)",(fid,uid,nickname or '用户'+phone[-4:]))
        cur.execute('INSERT INTO invite_codes(family_id,code,active,created_at) VALUES(%s,%s,1,UTC_TIMESTAMP())',(fid,secrets.token_hex(3).upper()))
        cur.execute('INSERT INTO app_family_data(family_id,payload) VALUES(%s,%s)',(fid,dumps(empty_family())))
    conn.commit();return read_data(conn,uid)

def join_family(conn,uid,code):
    if not isinstance(code,str) or not re.fullmatch(r'[A-Z0-9]{6}',code):raise ApiError('请输入6位邀请码')
    with conn.cursor() as cur:
        cur.execute('SELECT phone,nickname FROM users WHERE id=%s FOR UPDATE',(uid,))
        phone,nickname=cur.fetchone()
        cur.execute('SELECT id,family_id FROM members WHERE user_id=%s ORDER BY id LIMIT 1 FOR UPDATE',(uid,))
        member=cur.fetchone()
        cur.execute('SELECT family_id FROM invite_codes WHERE code=%s AND active=1 ORDER BY id DESC LIMIT 1',(code,))
        target=cur.fetchone()
        if not target:raise ApiError('邀请码无效')
        fid=target[0]
        if member and fid==member[1]:raise ApiError('你已在这个家庭中')
        cur.execute('SELECT id FROM families WHERE id IN (%s,%s) ORDER BY id FOR UPDATE',(fid,member[1] if member else fid))
        cur.fetchall()
        if member:
            cur.execute('SELECT revision FROM app_family_data WHERE family_id=%s FOR UPDATE',(member[1],))
            if cur.fetchone()[0]!=0:raise ApiError('当前家庭已有数据，不能直接切换家庭；不会自动合并账本')
            cur.execute('SELECT id FROM members WHERE family_id=%s FOR UPDATE',(member[1],))
            if len(cur.fetchall())>1:raise ApiError('当前家庭有其他成员，不能直接切换')
        cur.execute('SELECT id FROM members WHERE family_id=%s FOR UPDATE',(fid,))
        if len(cur.fetchall())>=8:raise ApiError('家庭成员已满')
        cur.execute('SELECT id FROM invite_codes WHERE family_id=%s AND code=%s AND active=1 FOR UPDATE',(fid,code))
        if not cur.fetchone():raise ApiError('邀请码已失效')
        if member:
            cur.execute("UPDATE members SET family_id=%s,role='member' WHERE id=%s",(fid,member[0]))
            cur.execute('UPDATE invite_codes SET active=0 WHERE family_id=%s',(member[1],))
        else:
            cur.execute("INSERT INTO members(family_id,user_id,role,display_name) VALUES(%s,%s,'member',%s)",(fid,uid,nickname or '用户'+phone[-4:]))
    conn.commit();return read_data(conn,uid)
