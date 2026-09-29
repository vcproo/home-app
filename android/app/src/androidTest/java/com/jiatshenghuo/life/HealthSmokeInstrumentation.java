package com.jiatshenghuo.life;

import android.app.Instrumentation;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import java.io.File;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import org.json.JSONArray;

/** Opt-in device integration test. Input is staged privately at runtime, never packaged. */
public class HealthSmokeInstrumentation extends Instrumentation {
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    private void check(boolean ok) throws Exception { if(!ok)throw new Exception("Device assertion failed"); }
    @Override public void onStart() {
        Bundle report=new Bundle();
        ModelConfigStore store=new ModelConfigStore(getTargetContext());
        JSONObject previous=null;
        File input=new File(getTargetContext().getFilesDir(),"vision-smoke-input.txt");
        File image=new File(getTargetContext().getFilesDir(),"vision-smoke-apple.jpg");
        Activity activity=null;
        String stage="read-input";
        try {
            previous=store.read();
            String[] lines=new String(Files.readAllBytes(input.toPath()),StandardCharsets.UTF_8).split("\\r?\\n");
            JSONObject config=new JSONObject();
            for(String line:lines){line=line.trim();if(line.startsWith("https://"))config.put("endpoint",line);else if(line.startsWith("sk-"))config.put("apiKey",line);else if(line.startsWith("deepseek-"))config.put("model",line);}
            check(config.has("apiKey") && config.has("endpoint") && config.has("model"));
            stage="encrypt-config";
            store.write(config);
            check(store.read().getString("apiKey").equals(config.getString("apiKey")));
            String encrypted=getTargetContext().getSharedPreferences("model-config",0).getString("encrypted","");
            check(!encrypted.contains(config.getString("apiKey")));
            Intent intent=new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            stage="launch-and-decode";
            activity=startActivitySync(intent);
            stage="decode-image";
            java.lang.reflect.Method read=MainActivity.class.getDeclaredMethod("readFoodPhoto",Uri.class);read.setAccessible(true);
            String data=(String)read.invoke(activity,Uri.fromFile(image));
            check(data.startsWith("data:image/jpeg;base64,") && data.length()<5*1024*1024);
            stage="redact-key";
            Class<?> bridge=Class.forName("com.jiatshenghuo.life.MainActivity$LocalBridge");
            java.lang.reflect.Constructor<?> ctor=bridge.getDeclaredConstructor(MainActivity.class);ctor.setAccessible(true);
            Object instance=ctor.newInstance(activity);
            java.lang.reflect.Method get=bridge.getDeclaredMethod("getModelConfig");get.setAccessible(true);
            JSONObject exposed=new JSONObject((String)get.invoke(instance));
            check(exposed.optBoolean("hasKey") && !exposed.has("apiKey"));
            JSONObject body=new JSONObject().put("max_tokens",2400).put("messages",new JSONArray().put(new JSONObject().put("role","user").put("content",new JSONArray().put(new JSONObject().put("type","text").put("text","Identify food in this image. Return JSON only: {\"foods\":[{\"name\":\"food\",\"calories\":95}],\"notes\":\"estimate\"}. Calories are estimates for shown portion.")).put(new JSONObject().put("type","image_url").put("image_url",new JSONObject().put("url",data))))));
            stage="https-request";
            JSONObject response=new JSONObject(new FoodVisionClient().request(store.read(),body));
            check(response.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content").contains("foods"));
            report.putString("stream","PASS: private configuration encryption, JS key redaction, native image decoding/compression and real HTTPS vision request.\n");
        } catch(Exception e) { Throwable cause=e.getCause()==null?e:e.getCause();report.putString("stream","FAIL: "+stage+" "+cause.getClass().getSimpleName()+(stage.equals("decode-image")?" "+cause.getMessage():" (details withheld to protect credentials)")+"\n"); }
        finally {
            try {if(previous!=null && previous.length()>0)store.write(previous);else store.clear();input.delete();image.delete();report.putBoolean("testConfigurationRemoved",!input.exists()&&!image.exists()&&(previous==null||previous.length()>0||store.read().length()==0));}catch(Exception e){report.putBoolean("testConfigurationRemoved",false);}
            if(activity!=null){Activity current=activity;runOnMainSync(current::finish);}
        }
        report.putString("stream",report.getString("stream","")+"testConfigurationRemoved="+report.getBoolean("testConfigurationRemoved")+"\n");
        finish(report.getString("stream","").startsWith("PASS")?Activity.RESULT_OK:Activity.RESULT_CANCELED,report);
    }
}
