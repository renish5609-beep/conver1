"""Verify presentation changes preserve the original application's contracts."""
import re, subprocess, pathlib
from html.parser import HTMLParser
BASE = '56d4b025609047386bc3acb3996090ee47c78f74'
ROOT = pathlib.Path(__file__).resolve().parents[1]
def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT).decode()
class Contracts(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.handlers=[]; self.fields=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id'])
        for key,value in attrs.items():
            if key.startswith('on'):self.handlers.append((tag,key,value))
        if tag in ['input','select','textarea','option']:
            self.fields.append((tag,tuple(sorted((k,v) for k,v in attrs.items() if k not in ['class','style']))))
def scripts(s):return re.findall(r'<script\b[^>]*>[\s\S]*?</script>',s,re.I)
count=0
for file in ['public/index.html','public/contact.html','public/privacy.html','public/terms.html','public/cookies.html','public/support.html']:
    before=original(file);after=(ROOT/file).read_text()
    original_scripts = scripts(before)
    updated_scripts = scripts(after)
    presentation_script = '<script src="/studio-ui.js?v=6" defer></script>'
    if file == 'public/index.html':
        assert updated_scripts.count(presentation_script) == 1, 'Presentation script must load exactly once'
        updated_scripts.remove(presentation_script)
        # Only this explicitly reviewed UI entry block differs from the original auth script.
        entry_block = """    // Studio entry: show the intro unless a visitor explicitly chose authentication.
    // Session restoration and email-verification handling above remain unchanged.
    const studioAuthView = new URLSearchParams(window.location.search).get('auth');
    if (!['signin', 'signup'].includes(studioAuthView)) {
      window.location.replace('/landing.html');
      return;
    }
    showAuthScreen();
    showView(studioAuthView);"""
        assert after.count(entry_block) == 1, 'Unexpected auth entry change'
        updated_scripts = [script.replace(entry_block, '    showAuthScreen();') for script in updated_scripts]
    assert original_scripts==updated_scripts,f'{file}: scripts changed'
    a,b=Contracts(),Contracts();a.feed(before);b.feed(after)
    assert a.ids==b.ids,f'{file}: original element IDs changed'
    assert a.handlers==b.handlers,f'{file}: original event handlers changed'
    assert a.fields==b.fields,f'{file}: form contracts changed'
    count+=4
for file in ['server.js','package.json','package-lock.json','capacitor.config.json','codemagic.yaml']:
    assert original(file)==(ROOT/file).read_text(),f'{file}: changed'
    count+=1
native=subprocess.check_output(['git','diff','--name-only',BASE,'--','ios'],cwd=ROOT).decode().splitlines()
assert set(native) <= {'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'}, 'Native iOS code/configuration changed'
count+=1
print(f'{count} preservation checks passed: original scripts (except reviewed entry UI), IDs, events, fields, backend, dependencies and native configuration retained; launcher image is the only allowed native change.')
