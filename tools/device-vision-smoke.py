"""Stages test inputs through private app stdin, invokes device test, verifies cleanup."""
from pathlib import Path
import subprocess
import base64
root = Path(__file__).resolve().parent.parent
adb = str(Path.home() / 'AppData/Local/Android/Sdk/platform-tools/adb.exe')
base = [adb, '-s', 'emulator-5554']
package = 'com.jiatshenghuo.life'
for source, target in [('api-key.txt', 'vision-smoke-input.txt'), ('artifacts/vision-apple.jpg', 'vision-smoke-apple.jpg')]:
    # tee's echoed input is discarded; secret never enters command arguments or output.
    result = subprocess.run(base + ['shell', '-T', 'run-as', package, 'sh', '-c', "'base64 -d > files/" + target + "'"], input=base64.b64encode((root/source).read_bytes())+b'\n', stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError('Private test staging failed')
    subprocess.run(base + ['shell','run-as',package,'test','-s','files/'+target],check=True)
    if target.endswith('.jpg'):
        import hashlib
        remote=subprocess.run(base+['exec-out','run-as',package,'cat','files/'+target],capture_output=True,check=True).stdout
        if hashlib.sha256(remote).digest()!=hashlib.sha256((root/source).read_bytes()).digest(): raise RuntimeError('Image staging integrity mismatch')
try:
    result = subprocess.run(base + ['shell', 'am', 'instrument', '-w', package + '.test/com.jiatshenghuo.life.HealthSmokeInstrumentation'], capture_output=True, timeout=180)
    output = result.stdout.decode('utf-8', errors='replace')
    (root/'artifacts/device-vision-smoke.txt').write_text(output, encoding='utf-8')
    print(output)
    if 'PASS:' not in output or 'testConfigurationRemoved=true' not in output: raise RuntimeError('Device integration test failed')
finally:
    # Exact disposable test inputs only; preserve all app data and the user's source file.
    subprocess.run(base + ['shell','run-as',package,'rm','-f','files/vision-smoke-input.txt','files/vision-smoke-apple.jpg'],stdout=subprocess.DEVNULL,check=True)
