package com.jiatshenghuo.life;

import android.app.*;
import android.content.*;
import android.os.Bundle;
import android.webkit.WebView;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Real HTTPS/MySQL round trip; isolated disposable account, original session restored. */
public class DatabaseSmokeInstrumentation extends Instrumentation {
    private WebView web;
    private Activity activity;
    private String js(String source) throws Exception {
        CountDownLatch done=new CountDownLatch(1);String[] result={"null"};
        runOnMainSync(()->web.evaluateJavascript(source,v->{result[0]=v;done.countDown();}));
        if(!done.await(5,TimeUnit.SECONDS))throw new Exception("JavaScript timeout");return result[0];
    }
    private void verify(String expression,String label) throws Exception {if(!"true".equals(js(expression)))throw new Exception(label);}
    private void waitFor(String expression,String label) throws Exception {
        for(int i=0;i<150;i++){if("true".equals(js(expression)))return;Thread.sleep(100);}
        throw new Exception(label+": "+js("JSON.stringify({route:state.route,error:state.formError,status:document.getElementById('cloud-status')?.textContent})"));
    }
    private void launch() throws Exception {
        activity=startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
        java.lang.reflect.Field f=MainActivity.class.getDeclaredField("webView");f.setAccessible(true);web=(WebView)f.get(activity);
        waitFor("typeof CloudSync!=='undefined' && typeof state!=='undefined'","Application load");
    }
    private void saved() throws Exception {waitFor("document.getElementById('cloud-status')?.textContent==='已保存到数据库'","Database save");}
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    @Override public void onStart(){
        Bundle out=new Bundle();ModelConfigStore config=new ModelConfigStore(getTargetContext(),"backend-session");JSONObject original=null;int uid=0;
        try {
            original=config.read();config.write(new JSONObject().put("endpoint","https://localhost:8787"));launch();
            String phone="198"+String.format(java.util.Locale.US,"%08d",new java.security.SecureRandom().nextInt(100000000));
            js("state.authMode='register';render();document.getElementById('phone').value='"+phone+"';document.getElementById('password').value='DBtest!872';document.getElementById('confirm').value='DBtest!872';submitAuth();true");
            waitFor("CloudSync.active && state.route==='home'","Registration");uid=config.read().getInt("userId");
            verify("state.accounts.length===0 && state.ledger.length===0 && healthCurrent().weight===null","New user received sample data");
            js("go('accounts');true");
            verify("document.querySelector('.asset-summary .hero').textContent==='0.00'","New account family assets must be zero");
            for(String route:new String[]{"assets","accounts","ledger","renqing-add","health","nutrition","health-person","weight","mine","members","cloud-settings"})
                verify("(()=>{go('"+route+"');return !!document.querySelector('main.screen');})()","Empty page "+route);
            js("go('home');go('ledger');document.querySelector('[data-go=\"account-form\"]').click();document.getElementById('acc-name').value='数据库联调账户';document.getElementById('acc-balance').value='1000';saveAccount();true");saved();
            verify("state.route==='ledger' && Number(document.getElementById('led-account').value)===state.accounts[0].id && state.navStack.map(p=>p.route).join(',')==='home'","Create account must resume ledger without extra levels");
            js("appBack();true");verify("state.route==='home'","Back after account creation should return to original page");
            js("go('accounts');document.querySelector('[data-account]').click();document.getElementById('edit-account').click();document.getElementById('acc-name').value='修改后的账户';saveAccount();true");saved();
            verify("state.route==='account-detail' && document.body.textContent.includes('修改后的账户')","Account editing should return to detail");
            js("appBack();true");verify("state.route==='accounts'","Detail back must return to accounts list");
            js("go('ledger');document.getElementById('led-title').value='联调午饭';document.getElementById('led-amount').value='25';document.getElementById('save-ledger').click();true");saved();
            verify("state.accounts[0].balance===975 && state.ledger.length===1","Ledger balance update");
            js("go('weight');document.getElementById('w-value').value='70.8';document.getElementById('save-weight').click();true");saved();
            verify("healthCurrent().delta===0 && healthCurrent().records.length===1","First weight delta");
            js("go('meal-form');document.getElementById('meal-name').value='联调米饭';document.getElementById('meal-calories').value='230';document.getElementById('save-meal').click();true");saved();
            java.io.File sample=java.io.File.createTempFile("address-smoke-",".jpg",getTargetContext().getCacheDir());
            android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(64,48,android.graphics.Bitmap.Config.ARGB_8888);bitmap.eraseColor(android.graphics.Color.GREEN);
            try(java.io.FileOutputStream stream=new java.io.FileOutputStream(sample)){bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG,80,stream);}finally{bitmap.recycle();}
            android.net.Uri uri=android.net.Uri.fromFile(sample);Intent selection=new Intent();ClipData clip=ClipData.newRawUri("test-photo",uri);clip.addItem(new ClipData.Item(uri));selection.setClipData(clip);
            ActivityMonitor pickerMonitor=addMonitor(new IntentFilter(Intent.ACTION_OPEN_DOCUMENT),null,true);
            try {
                js("go('address-add');document.getElementById('ad-name').value='测试地址';document.getElementById('ad-detail').value='测试门牌123';document.getElementById('add-address-photos').click();true");
                runOnMainSync(()->((MainActivity)activity).onActivityResult(44,Activity.RESULT_OK,selection));
                waitFor("state.draft.photos?.length===2 && !AddressPhotos.busy","Native multi-photo upload");
                verify("document.getElementById('ad-name').value==='测试地址' && document.getElementById('ad-detail').value==='测试门牌123'","Upload lost form input");
                js("document.getElementById('save-address').click();true");saved();
                js("document.querySelector('[data-address-edit]').click();document.getElementById('ad-name').value='编辑后的地址';document.getElementById('ad-detail').value='新的详细地址';document.querySelector('[data-photo-open]').click();true");
                waitFor("document.querySelector('#address-photo-viewer img')?.naturalWidth>0","Photo preview");
                js("appBack();document.querySelector('[data-photo-remove]').click();document.getElementById('save-address').click();true");saved();
                verify("state.addresses.length===1 && state.addresses[0].name==='编辑后的地址' && state.addresses[0].photos.length===1","Address edit duplicated or lost record");
                js("go('category-add');document.getElementById('cat-name').value='自定义图标测试';document.getElementById('upload-category-icon').click();true");
                runOnMainSync(()->((MainActivity)activity).onActivityResult(44,Activity.RESULT_OK,selection));
                waitFor("!!document.querySelector('#icon-crop-dialog canvas')","Category icon crop opens");
                js("document.getElementById('icon-zoom').value='2';document.getElementById('icon-zoom').dispatchEvent(new Event('input'));document.getElementById('confirm-icon-crop').click();true");
                waitFor("!!state.draft.customIcon && !document.getElementById('icon-crop-dialog')","Category crop upload");
                verify("document.getElementById('cat-name').value==='自定义图标测试' && document.querySelector('.category-type-row>span').getBoundingClientRect().height<25","Category name or type layout");
                js("document.getElementById('save-category').click();true");saved();
                waitFor("document.querySelector('.category-custom-image')?.naturalWidth===256","Category list cropped image");
                js("go('category-edit',{editingCategory:'自定义图标测试'});document.getElementById('cat-name').value='修改后的自定义分类';document.querySelector('[data-new-cat=income]').click();true");
                verify("document.querySelector('.category-type-row>span').getBoundingClientRect().height<25 && !!document.querySelector('.preview .category-custom-image')","Category edit layout and icon preserved");
                js("document.getElementById('save-category-edit').click();true");saved();
                verify("CAT_LOOK['修改后的自定义分类'].length===4 && state.categories.income.includes('修改后的自定义分类')","Category edit icon persistence");
            } finally {removeMonitor(pickerMonitor);sample.delete();}
            // Fresh native Activity restores its encrypted session and reads the database.
            runOnMainSync(()->activity.finish());Thread.sleep(350);launch();waitFor("CloudSync.active && state.route==='home'","Session restore");saved();
            verify("state.accounts[0].balance===975 && state.ledger.length===1 && healthCurrent().weight===70.8 && healthCurrent().meals[0].calories===230","Database restart restore");
            verify("state.addresses[0].name==='编辑后的地址' && state.addresses[0].photos.length===1","Address database restore");
            js("state.categoryKind='income';go('categories');true");
            waitFor("document.querySelector('.category-custom-image')?.naturalWidth===256","Custom icon database restore");
            js("go('addresses');document.querySelector('[data-address-edit]').click();true");
            waitFor("document.querySelector('[data-address-photo]')?.naturalWidth>0","Photo database reload after restart");
            // Force a failed write response; verify local outbox and exact idempotent retry.
            js("window.originalBackendResult=window.backendResult;window.backendResult=(id,result)=>{window.backendResult=window.originalBackendResult;window.originalBackendResult(id,{status:0,data:{error:'测试断网，等待重试'}});};state.addresses.push({id:7654321,name:'待同步地址',detail:'恢复后应保存'});persistState();true");
            waitFor("document.getElementById('cloud-status')?.textContent.includes('测试断网')","Failed save status");
            verify("JSON.parse(AndroidBridge.getCloudCache()).dirty===true","Outbox not retained");
            js("go('cloud-settings');document.getElementById('retry-cloud').click();true");saved();
            js("window.databaseRead=null;CloudSync.request('/api/data').then(v=>window.databaseRead=v);true");waitFor("!!window.databaseRead","Read back");
            verify("window.databaseRead.data.addresses.some(a=>a.id===7654321)","Retry missing database record");
            // A second client writes first; UI must preserve its own draft instead of overwriting.
            js("window.otherWrite=null;(()=>{const r=window.databaseRead,d={};for(const k of ['ledger','renqing','accounts','categories','houses','addresses','health','preferences','categoryLooks'])d[k]=r.data[k];d.preferences.hideAmounts=true;CloudSync.request('/api/data','PUT',{requestId:crypto.randomUUID(),familyId:r.user.familyId,familyRevision:r.familyRevision,personalRevision:r.personalRevision,data:d}).then(v=>window.otherWrite=v);})();true");
            waitFor("!!window.otherWrite","Other device write");
            js("state.addresses.push({id:7654322,name:'冲突草稿',detail:'不可丢失'});persistState();true");
            waitFor("document.getElementById('cloud-status')?.textContent.includes('其他设备更新')","Conflict warning");
            js("go('cloud-settings');document.getElementById('reload-cloud').click();true");
            waitFor("state.hideAmounts===true && !state.addresses.some(a=>a.id===7654322)","Conflict reload");
            verify("JSON.parse(AndroidBridge.getCloudCache()).archive.data.addresses.some(a=>a.id===7654322)","Conflict draft lost");
            // Session renewal retains pending outbox and does not reuse another account's records.
            js("window.backendResult=(id,result)=>{window.backendResult=window.originalBackendResult;window.originalBackendResult(id,{status:401,data:{error:'测试会话失效'}});};state.addresses.push({id:7654323,name:'重登草稿',detail:'重试保存'});persistState();true");
            waitFor("document.getElementById('cloud-status')?.textContent.includes('测试会话失效')","Expired session warning");
            js("go('cloud-settings');document.getElementById('cloud-relogin').click();true");waitFor("state.route==='login'","Reauthentication entry");
            js("document.getElementById('phone').value='"+phone+"';document.getElementById('password').value='DBtest!872';submitAuth();true");
            waitFor("CloudSync.active && state.route==='home'","Reauthentication");
            verify("state.addresses.some(a=>a.id===7654323) && CloudSync.pending","Outbox not restored after login");
            js("go('cloud-settings');document.getElementById('retry-cloud').click();true");saved();
            verify("!JSON.parse(AndroidBridge.getBackendConfig()).token","Token exposed to JavaScript");
            js("window.remoteHouseReady=false;CloudSync.request('/api/data').then(r=>{const d={};for(const k of ['ledger','renqing','accounts','categories','houses','addresses','health','preferences','categoryLooks'])d[k]=r.data[k];d.houses.push({id:87654,name:'其他成员新增房屋',water:'123',power:'',gas:''});return CloudSync.request('/api/data','PUT',{requestId:crypto.randomUUID(),familyId:r.user.familyId,familyRevision:r.familyRevision,personalRevision:r.personalRevision,data:d});}).then(()=>window.remoteHouseReady=true);true");
            waitFor("window.remoteHouseReady","Other member house write");
            js("go('house-add');document.getElementById('h-name').value='正在填写的房屋';CloudSync.syncShared();true");
            verify("document.getElementById('h-name').value==='正在填写的房屋' && !state.houses.some(h=>h.id===87654)","Background refresh overwrote editing form");
            js("go('houses');true");
            waitFor("state.houses.some(h=>h.id===87654) && document.body.textContent.includes('其他成员新增房屋')","Shared page automatic refresh");
            out.putString("stream","PASS: real HTTPS/MySQL; address edit, native multi-photo result, upload, preview, remove, restart image reload; ledger, health, outbox, conflict and login recovery.\n");
        }catch(Exception e){out.putString("stream","FAIL: "+e.getMessage()+"\n");}
        finally {
            try {if(uid==0)uid=config.read().optInt("userId");if(uid!=0){JSONObject current=config.read();BackendClient.request(current,"/api/logout","POST","{}");new ModelConfigStore(getTargetContext(),"cloud-cache-"+uid+"-"+"https://localhost:8787".hashCode()).clear();}if(original!=null)config.write(original);}catch(Exception ignored){}
            if(activity!=null)runOnMainSync(()->activity.finish());
        }
        out.putString("stream",out.getString("stream")+"TEST_UID="+uid+"\n");
        finish(out.getString("stream").startsWith("PASS")?Activity.RESULT_OK:Activity.RESULT_CANCELED,out);
    }
}
