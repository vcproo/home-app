"""Create a local-only certificate. Private key never goes in the APK or Git."""
from pathlib import Path
from datetime import datetime,timedelta,timezone
import ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa

root=Path(__file__).resolve().parent.parent
folder=root/'.local-server';folder.mkdir(exist_ok=True)
if not (folder/'server.key').exists():
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Home App Local Development')])
    now=datetime.now(timezone.utc)
    cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
          .serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=365))
          .add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True)
          .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),critical=False)
          .sign(key,hashes.SHA256()))
    (folder/'server.key').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    (folder/'server.crt').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
raw=root/'android/app/src/debug/res/raw';raw.mkdir(parents=True,exist_ok=True)
(raw/'local_server_ca.pem').write_bytes((folder/'server.crt').read_bytes())
print('Local certificate prepared; only public certificate copied to debug resources.')
