package com.jiatshenghuo.life;

import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.webkit.WebView;
import android.view.inputmethod.InputMethodManager;
import java.util.concurrent.*;

/** Exercises the real IME, without touching saved user data. */
public class KeyboardSmokeInstrumentation extends Instrumentation {
    private WebView web;
    private boolean simulated;
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    private String js(String source) throws Exception {
        CountDownLatch done=new CountDownLatch(1);String[] result={"null"};
        runOnMainSync(()->web.evaluateJavascript(source,v->{result[0]=v;done.countDown();}));
        if(!done.await(5,TimeUnit.SECONDS))throw new Exception("JavaScript timeout");return result[0];
    }
    private void verify(String code,String message) throws Exception {if(!"true".equals(js(code)))throw new Exception(message);}
    private void tapInput(String id) throws Exception {
        org.json.JSONArray point=new org.json.JSONArray(js("(()=>{const r=document.getElementById('"+id+"').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];})()"));
        int[] offset=new int[2];runOnMainSync(()->web.getLocationOnScreen(offset));float scale=getTargetContext().getResources().getDisplayMetrics().density;
        float x=(float)point.getDouble(0)*scale+offset[0],y=(float)point.getDouble(1)*scale+offset[1];long time=android.os.SystemClock.uptimeMillis();
        sendPointerSync(android.view.MotionEvent.obtain(time,time,android.view.MotionEvent.ACTION_DOWN,x,y,0));
        sendPointerSync(android.view.MotionEvent.obtain(time,time+60,android.view.MotionEvent.ACTION_UP,x,y,0));
    }
    @Override public void onStart(){
        Bundle out=new Bundle();Activity activity=null;
        try {
            activity=startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            java.lang.reflect.Field field=MainActivity.class.getDeclaredField("webView");field.setAccessible(true);web=(WebView)field.get(activity);
            for(int i=0;i<40 && !"true".equals(js("typeof state !== 'undefined' && typeof setNativeKeyboardViewport === 'function'"));i++)Thread.sleep(100);
            js("state.preview=true;go('weight');true");
            runOnMainSync(()->web.requestFocus());
            js("document.getElementById('w-value').focus();true");
            tapInput("w-value");
            runOnMainSync(()->((InputMethodManager)getTargetContext().getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(web,InputMethodManager.SHOW_FORCED));
            for(int i=0;i<30 && !"true".equals(js("document.body.classList.contains('keyboard-open')"));i++)Thread.sleep(100);
            simulated=!"true".equals(js("document.body.classList.contains('keyboard-open')"));
            if(simulated)js("setNativeKeyboardViewport(420,true);true");
            Thread.sleep(350);
            String bounds="(()=>{const r=document.activeElement.getBoundingClientRect(),b=document.querySelector('.bottom-action').getBoundingClientRect(),h=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--visible-height'));return r.top>=0 && r.bottom<=b.top && b.bottom<=h+2;})()";
            verify(bounds,"Weight input or save button obscured");
            js("document.getElementById('w-value').value='70.8';document.getElementById('w-value').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-picker-for=\"w-date\"]').click();true");
            Thread.sleep(250);
            verify("!!document.querySelector('[role=dialog]')","Date picker missing");
            verify("(()=>{const r=document.querySelector('[role=dialog]').getBoundingClientRect();return r.top>=0 && r.bottom<=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--visible-height'))+2;})()","Date picker exceeds visible viewport");
            js("document.getElementById('confirm-date').click();true");
            verify("document.getElementById('w-value').value==='70.8'","Date picker lost weight draft");
            js("document.getElementById('save-weight').click();go('meal-form');document.getElementById('meal-note').focus();true");
            runOnMainSync(()->((InputMethodManager)getTargetContext().getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(web,InputMethodManager.SHOW_FORCED));
            Thread.sleep(650);
            verify(bounds,"Long form field or save button obscured");
            for(String[] item:new String[][]{{"health-profile","hp-target"},{"model-settings","model-key"}}){
                js("go('"+item[0]+"');document.getElementById('"+item[1]+"').focus();true");
                if(simulated)js("setNativeKeyboardViewport(420,true);true");
                Thread.sleep(250);verify(bounds,item[0]+" field or save button obscured");
            }
            js("go('weight');document.getElementById('w-value').focus();true");
            if(simulated)js("setNativeKeyboardViewport(420,true);true");
            Thread.sleep(250);
            out.putString("stream","PASS: "+(simulated?"simulated 420px visible viewport (emulator IME did not open)":"real IME")+"; weight, meal, health profile and model settings input/save visible; date picker within viewport and draft preserved; preview-only data.\n");
        }catch(Exception e){out.putString("stream","FAIL: "+e.getMessage()+"\n");try{out.putString("stream",out.getString("stream")+js("JSON.stringify({focus:document.activeElement.id,inner:innerHeight,visual:visualViewport.height,visible:getComputedStyle(document.documentElement).getPropertyValue('--visible-height'),body:document.body.className})")+"\n");}catch(Exception ignored){}}
        try{android.graphics.Bitmap shot=getUiAutomation().takeScreenshot();if(shot!=null){try(java.io.FileOutputStream file=new java.io.FileOutputStream(new java.io.File(getTargetContext().getExternalFilesDir(null),"keyboard-check.png"))){shot.compress(android.graphics.Bitmap.CompressFormat.PNG,100,file);}shot.recycle();}}catch(Exception ignored){}
        if(activity!=null){Activity current=activity;runOnMainSync(()->{if(web!=null)((InputMethodManager)getTargetContext().getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(),0);current.finish();});}
        finish(out.getString("stream").startsWith("PASS")?Activity.RESULT_OK:Activity.RESULT_CANCELED,out);
    }
}
