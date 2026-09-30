"""Remove one explicitly identified disposable Android smoke-test user only."""
import sys
from store.mysql_store import connect, _verify_password

uid=int(sys.argv[1]);conn=connect()
try:
    with conn.cursor() as cur:
        cur.execute('SELECT phone,password_hash FROM users WHERE id=%s FOR UPDATE',(uid,));row=cur.fetchone()
        if not row or not row[0].startswith('198') or not _verify_password('DBtest!872',row[1]):raise RuntimeError('Not an Android smoke-test account; nothing removed')
        cur.execute('SELECT family_id FROM members WHERE user_id=%s',(uid,));families=[r[0] for r in cur.fetchall()]
        for fid in families:
            cur.execute('SELECT COUNT(*) FROM members WHERE family_id=%s AND user_id<>%s',(fid,uid))
            if cur.fetchone()[0]:raise RuntimeError('Family has other members; nothing removed')
        for table in ('app_sessions','app_write_receipts','app_legacy_backups','app_personal_data','members'):
            cur.execute(f'DELETE FROM {table} WHERE user_id=%s',(uid,))
        cur.execute('DELETE FROM users WHERE id=%s',(uid,))
        for fid in families:
            for table in ('app_address_photos','app_family_data','invite_codes'):
                cur.execute(f'DELETE FROM {table} WHERE family_id=%s',(fid,))
            cur.execute('DELETE FROM families WHERE id=%s',(fid,))
    conn.commit();print('Disposable smoke-test account removed; other data untouched.')
finally:conn.rollback();conn.close()
