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
        activity=startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
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
            for(String route:new String[]{"assets","accounts","ledger","renqing-add","health","nutrition","health-person","weight","mine","members","cloud-settings"})
                verify("(()=>{go('"+route+"');return !!document.querySelector('main.screen');})()","Empty page "+route);
            js("go('account-form');document.getElementById('acc-name').value='数据库联调账户';document.getElementById('acc-balance').value='1000';saveAccount();true");saved();
            js("go('ledger');document.getElementById('led-title').value='联调午饭';document.getElementById('led-amount').value='25';document.getElementById('save-ledger').click();true");saved();
            verify("state.accounts[0].balance===975 && state.ledger.length===1","Ledger balance update");
            js("go('weight');document.getElementById('w-value').value='70.8';document.getElementById('save-weight').click();true");saved();
            verify("healthCurrent().delta===0 && healthCurrent().records.length===1","First weight delta");
            js("go('meal-form');document.getElementById('meal-name').value='联调米饭';document.getElementById('meal-calories').value='230';document.getElementById('save-meal').click();true");saved();
            // Fresh native Activity restores its encrypted session and reads the database.
            runOnMainSync(()->activity.finish());Thread.sleep(350);launch();waitFor("CloudSync.active && state.route==='home'","Session restore");saved();
            verify("state.accounts[0].balance===975 && state.ledger.length===1 && healthCurrent().weight===70.8 && healthCurrent().meals[0].calories===230","Database restart restore");
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
            out.putString("stream","PASS: real HTTPS/MySQL registration, blank pages, ledger balance, weight, meals, Activity restart, encrypted outbox, lost-response retry, conflict archive and reauthentication recovery.\n");
        }catch(Exception e){out.putString("stream","FAIL: "+e.getMessage()+"\n");}
        finally {
            try {if(uid==0)uid=config.read().optInt("userId");if(uid!=0){JSONObject current=config.read();BackendClient.request(current,"/api/logout","POST","{}");new ModelConfigStore(getTargetContext(),"cloud-cache-"+uid+"-"+"https://localhost:8787".hashCode()).clear();}if(original!=null)config.write(original);}catch(Exception ignored){}
            if(activity!=null)runOnMainSync(()->activity.finish());
        }
        out.putString("stream",out.getString("stream")+"TEST_UID="+uid+"\n");
        finish(out.getString("stream").startsWith("PASS")?Activity.RESULT_OK:Activity.RESULT_CANCELED,out);
    }
}
