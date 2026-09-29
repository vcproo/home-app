"""Integration tests use real local MySQL, and delete only their own generated IDs."""
import copy
import secrets
import unittest
import uuid
from server.app import app, attempts
from server import database as db
from store.mysql_store import connect


class DatabaseIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):db.schema()

    def setUp(self):
        attempts.clear();self.client=app.test_client();self.users=[];self.families=[]
        self.a=self.register();self.b=self.register()

    def tearDown(self):
        conn=connect()
        try:
            with conn.cursor() as cur:
                for uid in self.users:
                    for table in ('app_sessions','app_write_receipts','app_legacy_backups','app_personal_data','members'):
                        cur.execute(f'DELETE FROM {table} WHERE user_id=%s',(uid,))
                    cur.execute('DELETE FROM users WHERE id=%s',(uid,))
                for fid in self.families:
                    for table in ('app_family_data','invite_codes'):
                        cur.execute(f'DELETE FROM {table} WHERE family_id=%s',(fid,))
                    cur.execute('DELETE FROM families WHERE id=%s',(fid,))
            conn.commit()
        finally:conn.close()

    def register(self):
        phone='199'+str(secrets.randbelow(10**8)).zfill(8)
        r=self.client.post('/api/auth/register',json={'phone':phone,'password':'Test!752'});self.assertEqual(r.status_code,200,r.json)
        value=r.json;value['phone']=phone;self.users.append(value['user']['id']);self.families.append(value['user']['familyId']);return value

    def call(self,account,method,path,body=None):
        return self.client.open(path,method=method,json=body,headers={'Authorization':'Bearer '+account['token']})

    def payload(self,account):
        return {**{k:account[k] for k in ('familyRevision','personalRevision')},'familyId':account['user']['familyId'],'requestId':str(uuid.uuid4()),'data':{k:copy.deepcopy(account['data'][k]) for k in db.FAMILY_KEYS+db.PERSONAL_KEYS}}

    def test_authentication(self):
        self.assertEqual(self.client.get('/api/data').status_code,401)
        self.assertEqual(self.client.post('/api/auth/login',json={'phone':self.a['phone'],'password':'Wrong!22'}).status_code,401)
        self.assertEqual(self.client.post('/api/auth/register',json={'phone':[], 'password':None}).status_code,400)
        self.assertEqual(self.call(self.a,'POST','/api/logout',{}).status_code,200)
        self.assertEqual(self.call(self.a,'GET','/api/data').status_code,401)

    def test_complete_roundtrip_and_restart(self):
        p=self.payload(self.a);d=p['data']
        d['accounts']=[dict(id=1,name='测试账户',type='现金',bank='',last4='',balance=875.5,counted=True)]
        d['ledger']=[dict(id=2,amount=24.5,kind='expense',category='餐饮',title='午饭',accountId=1,occurredOn='2026-09-29',day='9月29日',member='本人',source='manual')]
        d['renqing']=[dict(id=3,name='测试亲友',amount=100,side='out',accountId=1,reason='礼金')]
        d['houses']=[dict(id=4,name='测试房屋',water='123',power='234',gas='345')]
        d['addresses']=[dict(id=5,name='家',detail='测试地址',def_=True)]
        d['categoryLooks']={'餐饮':['fork','#f0f0f0','#123456']}
        d['preferences']={'hideAmounts':True}
        d['health']=[dict(sex='女',age=28,height=165,weight=55,delta=0,goal='maintain',activity='light',records=[dict(w=55,day='2026年9月29日',d=0)],meals=[dict(id='meal-1',name='米饭',calories=230,date='2026-09-29',portion='150g',mealType='午餐',source='manual')],deletedMeals=[])]
        r=self.call(self.a,'PUT','/api/data',p);self.assertEqual(r.status_code,200,r.json)
        # Every HTTP request has a fresh DB connection; new login simulates a fresh client.
        login=self.client.post('/api/auth/login',json={'phone':self.a['phone'],'password':'Test!752'}).json
        for k,v in d.items():self.assertEqual(login['data'][k],v,k)
        isolated=self.call(self.b,'GET','/api/data').json
        self.assertEqual(isolated['data']['accounts'],[]);self.assertEqual(isolated['data']['health'][0]['weight'],None)

    def test_conflict_atomicity_idempotency_and_scope(self):
        p=self.payload(self.a);p['data']['preferences']['hideAmounts']=True
        first=self.call(self.a,'PUT','/api/data',p);self.assertEqual(first.status_code,200)
        self.assertEqual(self.call(self.a,'PUT','/api/data',p).json,first.json)
        changed=copy.deepcopy(p);changed['data']['preferences']['hideAmounts']=False
        self.assertEqual(self.call(self.a,'PUT','/api/data',changed).status_code,409)
        stale=self.payload(self.a);stale['data']['addresses']=[dict(id=1,name='不能写入',detail='事务回滚')];stale['data']['preferences']={'new':1}
        self.assertEqual(self.call(self.a,'PUT','/api/data',stale).status_code,409)
        self.assertEqual(self.call(self.a,'GET','/api/data').json['data']['addresses'],[])
        p=self.payload(self.b);p['familyId']=self.a['user']['familyId']
        self.assertEqual(self.call(self.b,'PUT','/api/data',p).status_code,409)

    def test_family_shares_finance_but_not_health(self):
        old=self.a['data']['invite'];new=self.call(self.a,'POST','/api/family/invite',{}).json['invite']
        self.assertEqual(self.call(self.b,'POST','/api/family/join',{'code':old}).status_code,400)
        joined=self.call(self.b,'POST','/api/family/join',{'code':new});self.assertEqual(joined.status_code,200,joined.json)
        self.assertEqual(self.call(self.b,'POST','/api/family/invite',{}).status_code,403)
        p=self.payload(self.a);p['data']['health'][0]['weight']=80;p['data']['addresses']=[dict(id=1,name='共有地址',detail='地址')]
        self.assertEqual(self.call(self.a,'PUT','/api/data',p).status_code,200)
        other=self.call(self.b,'GET','/api/data').json
        self.assertEqual(other['data']['addresses'][0]['name'],'共有地址');self.assertIsNone(other['data']['health'][0]['weight'])

    def test_validation_and_backup_isolation(self):
        p=self.payload(self.a);p['data']['categories']['expense']=[{}]
        self.assertEqual(self.call(self.a,'PUT','/api/data',p).status_code,400)
        p=self.payload(self.a);p['data']['preferences']['apiKey']='never-store'
        self.assertEqual(self.call(self.a,'PUT','/api/data',p).status_code,400)
        backup={'version':1,'health':[{'weight':70},{'weight':60}]}
        self.assertEqual(self.call(self.a,'POST','/api/legacy-backup',backup).status_code,200)
        self.call(self.a,'POST','/api/legacy-backup',{'version':1})
        self.assertEqual(self.call(self.a,'GET','/api/legacy-backup').json,backup)
        self.assertEqual(self.call(self.b,'GET','/api/legacy-backup').status_code,404)

if __name__=='__main__':unittest.main()
