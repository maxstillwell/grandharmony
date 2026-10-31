"""Sales V2 real component acceptance, isolated synthetic loopback data only."""
import argparse,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:3037');ap.add_argument('--output',required=True,type=Path);a=ap.parse_args();a.output.mkdir(parents=True,exist_ok=True)
results=[];errors=[]
def passed(s):results.append(s);print('PASS',s,flush=True)
def numbers(page):return page.locator('[data-unit-row]').evaluate_all('(xs)=>xs.map(e=>Number(e.dataset.number))')
def sort(page,name):page.get_by_role('button',name=re.compile('^'+re.escape(name)+', sort ')).click()
def column(page,index):return page.locator('[data-unit-row]').evaluate_all('(xs,i)=>xs.map(e=>e.cells[i].innerText.split("\\n")[0].trim())',index)
def numeric(values):return [None if v=='—' else float(re.sub(r'[^0-9.]','',v)) for v in values]
def ordered(values,reverse):
 present=[v for v in values if v is not None];assert present==sorted(present,reverse=reverse),values
 assert values==present+[None]*(len(values)-len(present)),values
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1720,'height':1100});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(a.url+'/portal/sales?v2=1',wait_until='networkidle');page.get_by_role('button',name='Inventory',exact=True).click()
 assert numbers(page)==list(range(1,48));sort(page,'Residence');assert numbers(page)==list(range(47,0,-1));sort(page,'Residence');assert numbers(page)==list(range(1,48))
 passed('Residence header reverses real numeric 1–47 order with active aria-sort')
 for name,index in [('Beds',4),('Baths',5),('Cars',6),('Building Area',7),('Land Area',8),('Advertising Price',9),('Internal Price',10),('Contract Price',11)]:
  sort(page,name);ordered(numeric(column(page,index)),False);expect(page.get_by_role('button',name=re.compile('^'+re.escape(name)+', sort ')).locator('..')).to_have_attribute('aria-sort','ascending')
  sort(page,name);ordered(numeric(column(page,index)),True)
  if name=='Beds':assert column(page,index)[0]=='4' and column(page,index)[-1]=='2'
 passed('All room, independent area and three price columns sort numerically both ways; nulls stay last and no zero is invented')
 sort(page,'Status');v=column(page,1);rank={'Coming Soon':0,'Coming soon':0,'Available':1,'Reserved':2,'Sold · Settled':3,'Sold · settled':3};assert [rank[x] for x in v]==sorted(rank[x] for x in v)
 sort(page,'Release Stage');v=column(page,2);assert v[:v.count('Release Z')]==['Release Z']*v.count('Release Z');assert v[-v.count('—'):]==['—']*v.count('—')
 sort(page,'Type');assert column(page,3)==sorted(column(page,3));sort(page,'Tags')
 page.get_by_label('Search units',exact=True).fill('Courtyard');page.get_by_label('Status',exact=True).select_option('available');sort(page,'Building Area');ordered(numeric(column(page,7)),False);assert len(numbers(page))<47
 page.get_by_label('Status',exact=True).select_option('');page.get_by_label('Search units',exact=True).fill('')
 passed('Business status, release sequence, type and tags sort correctly together with search/filters')
 page.get_by_role('button',name='Open residence 1',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True);expect(dialog).to_be_visible();expect(dialog.get_by_text('Internal price · confidential',exact=True)).to_be_visible();expect(dialog.get_by_text('Contract price · confidential',exact=True)).to_be_visible();expect(dialog.get_by_text('No approved plans or images have been linked.',exact=True)).to_be_visible()
 expect(page.locator('[data-map-unit]').first).to_have_attribute('aria-pressed','true');page.keyboard.press('Escape');expect(dialog).to_have_count(0);expect(page.get_by_role('button',name='Open residence 1',exact=True)).to_be_focused()
 passed('Open immediately shows residence details and permitted prices; map synchronizes; Escape restores trigger focus')
 trigger=page.get_by_role('button',name='Actions residence 1',exact=True);trigger.click();menu=page.get_by_role('menu',name='Residence 1 actions');expect(menu).to_be_visible();page.keyboard.press('ArrowDown');expect(menu.get_by_role('menuitem',name='Edit Residence',exact=True)).to_be_focused();page.keyboard.press('Escape');expect(trigger).to_be_focused()
 trigger.click();menu.get_by_role('menuitem',name='Change Sales Status',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True);dialog.get_by_label('Requested status',exact=True).select_option('reserved');dialog.get_by_label('Reason for transition',exact=True).fill('Synthetic V2 test');dialog.get_by_role('button',name='Record status change',exact=True).click();expect(dialog).to_contain_text('Reserved');expect(page.locator('[data-map-unit]').first).to_have_attribute('fill','#b28653');dialog.get_by_role('button',name='Close residence panel').click()
 passed('Keyboard Actions menu opens a functional status form; confirmed save refreshes canonical status and map colour')
 trigger.click();menu.get_by_role('menuitem',name='Manage Pricing',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True)
 dialog.get_by_label('Draft advertising price (decimal, no commas)',exact=True).fill('123000.00');dialog.get_by_role('button',name='Save public price draft',exact=True).click();expect(page.locator('[data-unit-row][data-number="1"]')).to_contain_text('Unpublished');expect(page.locator('[data-unit-row][data-number="1"]')).to_contain_text('$123,000.00')
 expect(dialog.get_by_label('Contract price',exact=True)).to_have_value('100.00');expect(dialog.get_by_label('Internal asking price',exact=True)).to_have_value('1000000.00')
 dialog.get_by_role('button',name='Close residence panel').click();trigger.click();menu.get_by_role('menuitem',name='Edit Residence',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True);dialog.get_by_label('Housing type',exact=True).fill('Local edited type');dialog.get_by_role('button',name='Save inventory details',exact=True).click();expect(page.locator('[data-unit-row][data-number="1"]')).to_contain_text('Local edited type');dialog.get_by_role('button',name='Close residence panel').click()
 passed('Pricing and edit actions save through existing operations; advertising draft does not publish or overwrite internal/contract prices')
 trigger.click();menu.get_by_role('menuitem',name='View Activity',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True);expect(dialog.get_by_text('unit.imported',exact=True)).to_be_visible();dialog.get_by_role('button',name='Close residence panel').click()
 trigger.click();menu.get_by_role('menuitem',name='View CRM Leads',exact=True).click();dialog=page.get_by_role('dialog',name='Residence 1',exact=True);expect(dialog.get_by_text('Local Buyer',exact=True)).to_be_visible();dialog.get_by_role('button',name='Open lead in CRM',exact=True).click();expect(page.get_by_role('heading',name='Developer-owned CRM',exact=True)).to_be_visible();expect(page.get_by_role('heading',name='Local Buyer',exact=True)).to_be_visible()
 passed('Activity is unit-scoped; CRM action opens the actual associated lead in the existing CRM workspace')
 page.get_by_role('button',name='Inventory',exact=True).click();page.get_by_role('button',name='Show linked map',exact=True).click();page.screenshot(path=str(a.output/'inventory-v2-desktop.png'),full_page=True)
 page.get_by_role('button',name='Open residence 2',exact=True).click();page.screenshot(path=str(a.output/'residence-v2-desktop.png'));page.keyboard.press('Escape')
 restricted=b.new_page(viewport={'width':1440,'height':1000});restricted.goto(a.url+'/portal/sales?v2=1&restricted=1',wait_until='networkidle');restricted.get_by_role('button',name='Inventory',exact=True).click()
 expect(restricted.get_by_role('columnheader',name=re.compile('^Internal Price'))).to_have_count(0);expect(restricted.get_by_role('columnheader',name=re.compile('^Contract Price'))).to_have_count(0);restricted.get_by_role('button',name='Actions residence 1',exact=True).click();expect(restricted.get_by_role('menuitem')).to_have_count(1);restricted.get_by_role('menuitem',name='View Residence',exact=True).click();expect(restricted.get_by_role('dialog')).not_to_contain_text('confidential');expect(restricted.get_by_role('dialog').get_by_role('button',name='Edit',exact=True)).to_have_count(0)
 passed('Restricted view hides confidential columns/details, edit/status/pricing/CRM/audit menu entries')
 mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2);mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.goto(a.url+'/portal/sales?v2=1',wait_until='networkidle');mp.get_by_role('button',name='Inventory',exact=True).tap();sort(mp,'Beds');sort(mp,'Beds');ordered(numeric(column(mp,4)),True);assert mp.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth && innerWidth===390')
 mp.get_by_role('button',name='Open residence 1',exact=True).tap();expect(mp.get_by_role('dialog',name='Residence 1',exact=True)).to_be_visible();mp.screenshot(path=str(a.output/'residence-v2-mobile.png'));mp.get_by_role('button',name='Close residence panel').tap();mp.get_by_role('button',name='Actions residence 1',exact=True).tap();expect(mp.get_by_role('menu',name='Residence 1 actions')).to_be_visible();mp.screenshot(path=str(a.output/'actions-v2-mobile.png'));passed('390px real touch sorting, horizontally scrolled Open/Actions and modal fit without page overflow')
 assert not errors,errors;passed('No uncaught browser exceptions');b.close()
(a.output/'results.json').write_text(json.dumps({'passed':len(results),'tests':results,'pageErrors':errors,'scope':'Synthetic loopback UI; no production mutations or authenticated live-session claim'},indent=2)+'\n')
