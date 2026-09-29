"""Export schema + AES-256-GCM encrypted MySQL backup; keys remain local."""
import argparse
from datetime import datetime
from pathlib import Path
import os
import re
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from store.mysql_store import connect

HEADER=b'HOMEAPPDB1\n'
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
sub=parser.add_subparsers(dest='action',required=True)
export=sub.add_parser('export');export.add_argument('--version',required=True)
decrypt=sub.add_parser('decrypt');decrypt.add_argument('--backup',required=True);decrypt.add_argument('--key',required=True);decrypt.add_argument('--output',required=True)
args=parser.parse_args()
if args.action=='decrypt':
    encrypted=Path(args.backup).read_bytes()
    if not encrypted.startswith(HEADER):raise ValueError('Unrecognized backup format')
    key=bytes.fromhex(Path(args.key).read_text().strip());start=len(HEADER)
    plaintext=AESGCM(key).decrypt(encrypted[start:start+12],encrypted[start+12:],HEADER)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('xb') as f:f.write(plaintext)
    print('Backup decrypted to requested local file; import into an empty database.')
else:
    if not re.fullmatch(r'[A-Za-z0-9.-]+',args.version):raise ValueError('Invalid version')
    target=root/'artifacts'/f'home-app-database-{args.version}.sql.enc'
    key_path=root/'.local-server'/'backups'/f'home-app-database-{args.version}.key'
    if target.exists() or key_path.exists():raise FileExistsError('Backup or key exists; choose a new version to prevent key loss')
    schema=['-- Home App MySQL schema. No personal data or credentials.','SET NAMES utf8mb4;']
    data=['-- Restore into an EMPTY database. Active sessions deliberately excluded.','SET NAMES utf8mb4;',"SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",'START TRANSACTION;']
    conn=connect();count=0
    try:
        with conn.cursor() as cur:
            cur.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT')
            cur.execute('SHOW TABLES');tables=[r[0] for r in cur.fetchall()]
            for table in tables:
                cur.execute('SHOW CREATE TABLE `'+table+'`');ddl=cur.fetchone()[1]
                ddl=re.sub(r' AUTO_INCREMENT=\d+','',ddl)
                schema.append(ddl+';')
                if table=='app_sessions':continue
                cur.execute('SELECT * FROM `'+table+'`');columns=[d[0] for d in cur.description]
                for row in cur.fetchall():
                    data.append('INSERT INTO `'+table+'` ('+','.join('`'+c+'`' for c in columns)+') VALUES ('+','.join(conn.escape(v) for v in row)+');');count+=1
        data.append('COMMIT;')
    finally:conn.rollback();conn.close()
    schema_text='\n\n'.join(schema)+'\n'
    (root/'database').mkdir(exist_ok=True)
    (root/'database'/'schema.sql').write_text(schema_text,encoding='utf-8')
    plaintext=(schema_text+'\n'+'\n'.join(data)+'\n').encode('utf-8')
    key=AESGCM.generate_key(bit_length=256);nonce=os.urandom(12)
    encrypted=HEADER+nonce+AESGCM(key).encrypt(nonce,plaintext,HEADER)
    key_path.parent.mkdir(parents=True,exist_ok=True);target.parent.mkdir(exist_ok=True)
    with key_path.open('x') as f:f.write(key.hex()+'\n')
    with target.open('xb') as f:f.write(encrypted)
    assert AESGCM(key).decrypt(nonce,encrypted[len(HEADER)+12:],HEADER)==plaintext
    print(f'Exported {len(tables)} table definitions and encrypted {count} records; session rows excluded. Encryption round-trip verified. Key remains under .local-server/backups/.')
