"""Local-only PGlite harness acceptance; never point at Production.
Run scripts/sales-full-harness.mjs before this test. All identities are synthetic.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import argparse
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:3061');ap.add_argument('--output',type=Path,default=Path('docs/verification/sales-experience-v1'));a=ap.parse_args();out=a.output;out.mkdir(parents=True,exist_ok=True)
from urllib.parse import urlparse
assert urlparse(a.url).hostname in ('127.0.0.1','localhost'), 'Only the disposable loopback harness is allowed'
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 base=a.url;page.request.delete(base+'/api/test');page.goto(base+'/portal/sales?mode=demo&tab=Media&residence=2',wait_until='networkidle',timeout=120000)
 expect(page.get_by_role('heading',name='Residence media & revisions')).to_be_visible(timeout=90000)
 snapshot=lambda demo=True: page.request.get(base+'/api/test'+('?mode=demo' if demo else '')).json()
 before=snapshot();canonical=before['canonical'];unit=next(u for u in before['data']['units'] if u['number']=='2');page.get_by_label('Media residence').select_option(unit['id'])
 page.get_by_role('button',name='Load abstract test revisions').click();expect(page.get_by_role('button',name='Inspect version 2 · ground')).to_be_visible(timeout=30000)
 assert len(snapshot()['media']['versions'])==4;results.append('Real service creates four synthetic demo media versions tied to one canonical residence, no inventory copy')
 page.get_by_role('button',name='Inspect version 2 · ground').click();expect(page.get_by_text('Before · TEST A',exact=True)).to_be_visible();expect(page.get_by_text('After · TEST B',exact=True)).to_be_visible()
 def decision(action):
  if action!='review':page.get_by_label('Media decision').select_option(action)
  page.get_by_label('Review evidence / architectural approval reference').fill('SYNTHETIC MECHANICS TEST ONLY — owner local browser')
  page.get_by_label('Confirm review authority and the exact residence, floor and version').check();page.get_by_role('button',name='Record media decision').click();page.wait_for_timeout(700)
 decision('review');expect(page.get_by_label('Media decision')).to_have_value('approve',timeout=10000);decision('approve')
 def publish():
  page.get_by_label('Promotion / restore reason').fill('SYNTHETIC isolated pointer acceptance test');page.get_by_label('Confirm simulated promotion only; never publish this fixture').check();page.get_by_role('button',name='Promote / restore selected version').click();page.wait_for_timeout(700)
 expect(page.get_by_role('button',name='Promote / restore selected version')).to_be_visible();publish()
 current=snapshot()['media']['current'];assert len(current)==1;ground=current[0]['mediaId'];results.append('Before/after browser preview, separate review and approval, and simulated current pointer use actual services')
 page.screenshot(path=str(out/'media-revisions-desktop.png'),full_page=True)
 page.get_by_role('button',name='Inspect version 1 · first').click();decision('review');decision('approve');publish();first=next(c for c in snapshot()['media']['current'] if c['floorId']=='first')['mediaId']
 page.get_by_role('button',name='Inspect version 1 · ground').click();decision('review');decision('approve');publish();state=snapshot();assert next(c for c in state['media']['current'] if c['floorId']=='first')['mediaId']==first;assert next(c for c in state['media']['current'] if c['floorId']=='ground')['mediaId']!=ground
 assert state['canonical']==canonical;assert snapshot(False)['media']['versions']==[];results.append('Restoring older approved ground asset preserves first floor and every real inventory/price byte; demo versions absent from real scope')
 page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='Inspect version 2 · ground').scroll_into_view_if_needed();page.get_by_role('button',name='Inspect version 2 · ground').click();page.get_by_role('heading',name='Ground Floor · version 2').scroll_into_view_if_needed();page.screenshot(path=str(out/'media-revisions-mobile.png'),full_page=False);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');results.append('Mobile media table, revision preview and decision controls remain operable without document overflow')
 assert not errors,errors;b.close()
(out/'browser-results.json').write_text(json.dumps({'tests':results,'passed':len(results),'pageErrors':errors,'environment':'Loopback PGlite fixture, real application components and services; not authenticated Production acceptance'},indent=2)+'\n');print(json.dumps(results))
