package com.jiatshenghuo.life;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Offline UI host. The JS bridge is reachable only from packaged app assets. */
public class MainActivity extends Activity {
    private static final int EXPORT_REQUEST = 41;
    private static final int FOOD_PICK = 42, FOOD_CAMERA = 43;
    private static final int ADDRESS_PICK = 44;
    private String addressPhotoSession;
    private int addressPhotoLimit;
    private final java.util.concurrent.ExecutorService foodExecutor = java.util.concurrent.Executors.newFixedThreadPool(2);
    private final java.util.concurrent.ExecutorService backendExecutor = java.util.concurrent.Executors.newSingleThreadExecutor();
    private volatile FoodVisionClient foodClient;
    private boolean choosingFood;
    private WebView webView;
    private String pendingExport;
    private int topInset = 24;
    private int bottomInset = 24;

    @Override @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
            (android.os.Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(247,247,244));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        webView.addJavascriptInterface(new LocalBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) { applyInsets(); lastVisibleHeight=-1; reportKeyboardViewport(); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/www/");
            }
        });
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            float density = getResources().getDisplayMetrics().density;
            topInset = Math.round(insets.getSystemWindowInsetTop()/density);
            // Stable navigation insets exclude the software keyboard height.
            bottomInset = Math.round(insets.getStableInsetBottom()/density);
            applyInsets();
            return insets;
        });
        setContentView(webView);
        webView.getViewTreeObserver().addOnGlobalLayoutListener(this::reportKeyboardViewport);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void applyInsets() {
        if (webView == null) return;
        webView.evaluateJavascript("document.documentElement.style.setProperty('--top-inset','"+
            Math.max(56,topInset+16)+"px');document.documentElement.style.setProperty('--bottom-inset','"+
            Math.max(12,bottomInset)+"px');", null);
    }

    private int lastVisibleHeight = -1;
    private boolean lastKeyboardVisible;
    private void reportKeyboardViewport() {
        if (webView == null || webView.getHeight() == 0) return;
        android.graphics.Rect visible = new android.graphics.Rect();
        webView.getWindowVisibleDisplayFrame(visible);
        int[] position = new int[2];webView.getLocationOnScreen(position);
        float density = getResources().getDisplayMetrics().density;
        int height = Math.round(Math.min(webView.getHeight(),Math.max(0,visible.bottom-position[1]))/density);
        android.graphics.Point display = new android.graphics.Point();
        getWindowManager().getDefaultDisplay().getRealSize(display);
        boolean open = display.y-visible.bottom > 100*density;
        if(height==lastVisibleHeight && open==lastKeyboardVisible)return;
        lastVisibleHeight=height;lastKeyboardVisible=open;
        webView.evaluateJavascript("window.setNativeKeyboardViewport && setNativeKeyboardViewport("+height+","+open+")",null);
    }

    @Override public void onBackPressed() {
        webView.evaluateJavascript("typeof appBack==='function' && appBack()", handled -> {
            if (!"true".equals(handled)) MainActivity.super.onBackPressed();
        });
    }

    private void message(String text) {
        webView.evaluateJavascript("toast("+JSONObject.quote(text)+")",null);
    }

    private final class LocalBridge {
        @JavascriptInterface public void chooseAddressPhotos(String session,int limit) {
            runOnUiThread(()->{
                if(addressPhotoSession!=null)return;
                addressPhotoSession=session;addressPhotoLimit=Math.max(1,Math.min(9,limit));
                try{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("image/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});startActivityForResult(intent,ADDRESS_PICK);}
                catch(Exception e){addressPhotoSession=null;addressPhotosCallback(session,new org.json.JSONArray(),"无法打开相册，请检查是否有可用的图片应用");}
            });
        }
        @JavascriptInterface public String getBackendConfig(){
            try{JSONObject config=new ModelConfigStore(MainActivity.this,"backend-session").read();return new JSONObject().put("endpoint",config.optString("endpoint","https://localhost:8787")).put("hasSession",!config.optString("token").isEmpty()).toString();}catch(Exception e){return "{}";}
        }
        @JavascriptInterface public String setBackendEndpoint(String endpoint){
            try{new ModelConfigStore(MainActivity.this,"backend-session").write(new JSONObject().put("endpoint",BackendClient.endpoint(endpoint)));return "{\"ok\":true}";}catch(Exception e){return "{\"error\":\"服务地址保存失败，请使用HTTPS地址\"}";}
        }
        @JavascriptInterface public void clearBackendSession(){
            try{ModelConfigStore store=new ModelConfigStore(MainActivity.this,"backend-session");JSONObject config=store.read();config.remove("token");config.remove("userId");store.write(config);}catch(Exception ignored){}
        }
        @JavascriptInterface public String getCloudCache(){
            try{JSONObject config=new ModelConfigStore(MainActivity.this,"backend-session").read();if(!config.has("userId"))return "{}";return new ModelConfigStore(MainActivity.this,"cloud-cache-"+config.getInt("userId")+"-"+config.optString("endpoint").hashCode()).read().toString();}catch(Exception e){return "{}";}
        }
        @JavascriptInterface public String saveCloudCache(String value){
            try{JSONObject config=new ModelConfigStore(MainActivity.this,"backend-session").read();if(!config.has("userId"))throw new Exception();new ModelConfigStore(MainActivity.this,"cloud-cache-"+config.getInt("userId")+"-"+config.optString("endpoint").hashCode()).write(new JSONObject(value));return "{\"ok\":true}";}catch(Exception e){return "{\"error\":\"本机草稿保存失败，请不要关闭页面\"}";}
        }
        @JavascriptInterface public void backendRequest(String id,String path,String method,String body){
            backendExecutor.execute(()->{
                JSONObject result;
                try{
                    ModelConfigStore store=new ModelConfigStore(MainActivity.this,"backend-session");JSONObject config=store.read();
                    if(!config.has("endpoint"))config.put("endpoint","https://localhost:8787");
                    result=BackendClient.request(config,path,method,body);
                    JSONObject response=result.getJSONObject("data");
                    if(result.getInt("status")==200 && response.has("token")){
                        JSONObject current=store.read();
                        if(!current.optString("endpoint","https://localhost:8787").equals(config.getString("endpoint")))throw new Exception("服务地址已变更");
                        config.put("token",response.getString("token"));config.put("userId",response.getJSONObject("user").getInt("id"));store.write(config);response.remove("token");
                    }
                }catch(Exception e){result=new JSONObject();try{result.put("status",0).put("data",new JSONObject().put("error","无法连接服务，请检查电脑后端是否运行及服务地址。修改仍保留在本机待同步。"));}catch(Exception ignored){}}
                final JSONObject answer=result;
                runOnUiThread(()->{if(webView!=null)webView.evaluateJavascript("window.backendResult && backendResult("+JSONObject.quote(id)+","+answer.toString()+")",null);});
            });
        }
        @JavascriptInterface public void chooseFoodPhoto(boolean camera) {
            runOnUiThread(() -> {
                if(choosingFood)return;
                choosingFood=true;
                try {
                    if(camera){
                        Uri uri=Uri.parse("content://com.jiatshenghuo.life.foodphoto/food-capture.jpg");
                        Intent intent=new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
                        intent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT,uri);
                        intent.setClipData(ClipData.newRawUri("食物照片",uri));
                        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivityForResult(intent,FOOD_CAMERA);
                    } else {
                        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType("image/*");intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});
                        startActivityForResult(intent,FOOD_PICK);
                    }
                } catch(Exception e){choosingFood=false;photoCallback(null,"无法打开相机或相册，请检查是否有可用应用");}
            });
        }
        @JavascriptInterface public void cancelFoodRequest() { if(foodClient!=null)foodClient.cancel(); }
        @JavascriptInterface public void analyzeFood(String id,String body) {
            if(foodClient!=null)foodClient.cancel();
            FoodVisionClient client=new FoodVisionClient();foodClient=client;
            foodExecutor.execute(() -> {
                JSONObject result=new JSONObject();
                try {result.put("response",client.request(new ModelConfigStore(MainActivity.this).read(),new JSONObject(body)));}
                catch(Exception e){try{result.put("error",e instanceof java.net.SocketTimeoutException ? "识别超时，请重试" : e instanceof java.io.IOException ? "网络连接失败，请检查网络后重试" : e.getMessage());}catch(Exception ignored){}}
                runOnUiThread(() -> {if(webView!=null)webView.evaluateJavascript("foodVisionResult("+JSONObject.quote(id)+","+result.toString()+")",null);});
            });
        }
        @JavascriptInterface public String getModelConfig() {
            try {
                JSONObject config = new ModelConfigStore(MainActivity.this).read();
                config.put("hasKey", !config.optString("apiKey").isEmpty());
                config.remove("apiKey");
                return config.toString();
            } catch (Exception e) { return "{\"error\":\"无法读取模型配置，请重新配置\"}"; }
        }
        @JavascriptInterface public String saveModelConfig(String json) {
            try {
                JSONObject config = new JSONObject(json);
                java.net.URI endpoint = new java.net.URI(config.getString("endpoint"));
                if (!"https".equalsIgnoreCase(endpoint.getScheme()) || endpoint.getHost()==null || endpoint.getUserInfo()!=null || endpoint.getQuery()!=null || endpoint.getFragment()!=null || config.optString("model").trim().isEmpty())
                    return "{\"error\":\"请填写有效的 HTTPS 接口地址和模型名称\"}";
                ModelConfigStore store = new ModelConfigStore(MainActivity.this);
                JSONObject previous = store.read();
                if (config.optString("apiKey").isEmpty() && !config.optBoolean("clearKey")) {
                    if (!previous.optString("apiKey").isEmpty() && !FoodVisionClient.endpoint(previous.optString("endpoint")).equals(FoodVisionClient.endpoint(config.getString("endpoint"))))
                        return "{\"error\":\"更换接口地址后请重新输入密钥\"}";
                    config.put("apiKey",previous.optString("apiKey"));
                }
                config.remove("clearKey");
                store.write(config);
                return "{\"ok\":true}";
            } catch (Exception e) { return "{\"error\":\"保存失败，请检查配置后重试\"}"; }
        }
        @JavascriptInterface public void clearModelConfig() { new ModelConfigStore(MainActivity.this).clear(); }
        @JavascriptInterface public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager manager = (ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                manager.setPrimaryClip(ClipData.newPlainText("家庭生活",text));
            });
        }
        @JavascriptInterface public void share(String text) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain"); intent.putExtra(Intent.EXTRA_TEXT,text);
                try { startActivity(Intent.createChooser(intent,"分享邀请")); }
                catch (ActivityNotFoundException e) { message("没有可用的分享应用，请复制邀请码"); }
            });
        }
        @JavascriptInterface public void navigate(String address) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q="+Uri.encode(address)));
                try { startActivity(intent); }
                catch (ActivityNotFoundException e) { message("未安装地图应用，请复制地址后导航"); }
            });
        }
        @JavascriptInterface public void exportData(String json) {
            runOnUiThread(() -> {
                pendingExport = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,"家庭生活-备份.json");
                try { startActivityForResult(intent,EXPORT_REQUEST); }
                catch (ActivityNotFoundException e) { pendingExport=null; message("无法打开文件保存器"); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if(request==ADDRESS_PICK){
            String session=addressPhotoSession;addressPhotoSession=null;
            if(session==null)return;
            if(result!=RESULT_OK||data==null){addressPhotosCallback(session,new org.json.JSONArray(),null);return;}
            java.util.ArrayList<Uri> uris=new java.util.ArrayList<>();
            if(data.getClipData()!=null){for(int i=0;i<Math.min(addressPhotoLimit,data.getClipData().getItemCount());i++)uris.add(data.getClipData().getItemAt(i).getUri());}
            else if(data.getData()!=null)uris.add(data.getData());
            foodExecutor.execute(()->{org.json.JSONArray images=new org.json.JSONArray();try{for(Uri uri:uris)images.put(readFoodPhoto(uri));addressPhotosCallback(session,images,null);}catch(Exception e){addressPhotosCallback(session,new org.json.JSONArray(),"部分图片无法读取，请重新选择 JPG、PNG 或 WebP 图片");}});return;
        }
        if(request==FOOD_PICK || request==FOOD_CAMERA){
            choosingFood=false;
            if(result!=RESULT_OK){if(request==FOOD_CAMERA)new java.io.File(getCacheDir(),"food-capture.jpg").delete();return;}
            Uri uri=request==FOOD_CAMERA ? Uri.parse("content://com.jiatshenghuo.life.foodphoto/food-capture.jpg") : data==null ? null : data.getData();
            if(uri==null){photoCallback(null,"未能读取所选照片");return;}
            foodExecutor.execute(() -> {
                try{photoCallback(readFoodPhoto(uri),null);}catch(Exception e){photoCallback(null,"照片无法读取或格式不支持，请换一张照片");}
                finally{if(request==FOOD_CAMERA){new java.io.File(getCacheDir(),"food-capture.jpg").delete();revokeUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);}}
            });return;
        }
        if (request != EXPORT_REQUEST) return;
        String content = pendingExport; pendingExport = null;
        if (result != RESULT_OK || data == null || data.getData() == null || content == null) return;
        try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
            if (stream == null) throw new java.io.IOException("No output stream");
            stream.write(content.getBytes(StandardCharsets.UTF_8));
            message("备份已保存");
        } catch (Exception e) { message("保存失败，请检查存储空间后重试"); }
    }

    @Override protected void onDestroy() {
        backendExecutor.shutdownNow();
        if(foodClient!=null)foodClient.cancel();foodExecutor.shutdownNow();
        if (webView != null) { webView.removeJavascriptInterface("AndroidBridge"); webView.destroy();webView=null; }
        super.onDestroy();
    }

    private void photoCallback(String image,String error){
        runOnUiThread(() -> {try{JSONObject result=new JSONObject();if(image!=null)result.put("image",image);if(error!=null)result.put("error",error);if(webView!=null)webView.evaluateJavascript("foodPhotoResult("+result.toString()+")",null);}catch(Exception ignored){}});
    }
    private void addressPhotosCallback(String session,org.json.JSONArray images,String error){
        runOnUiThread(()->{try{JSONObject result=new JSONObject().put("images",images);if(error!=null)result.put("error",error);if(webView!=null)webView.evaluateJavascript("window.addressPhotosResult && addressPhotosResult("+JSONObject.quote(session)+","+result+")",null);}catch(Exception ignored){}});
    }
    private String readFoodPhoto(Uri uri) throws Exception {
        android.graphics.BitmapFactory.Options options=new android.graphics.BitmapFactory.Options();options.inJustDecodeBounds=true;
        try(java.io.InputStream in=getContentResolver().openInputStream(uri)){android.graphics.BitmapFactory.decodeStream(in,null,options);}
        if(options.outWidth<=0 || options.outHeight<=0)throw new java.io.IOException("Invalid image");
        options.inSampleSize=1;while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>1600)options.inSampleSize*=2;
        options.inJustDecodeBounds=false;android.graphics.Bitmap bitmap;
        try(java.io.InputStream in=getContentResolver().openInputStream(uri)){bitmap=android.graphics.BitmapFactory.decodeStream(in,null,options);}
        if(bitmap==null)throw new java.io.IOException("Invalid bitmap");
        try{
            int orientation=1;try(java.io.InputStream in=getContentResolver().openInputStream(uri)){orientation=new android.media.ExifInterface(in).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION,1);}catch(Exception ignored){}
            android.graphics.Matrix matrix=new android.graphics.Matrix();
            switch(orientation){case 2:matrix.setScale(-1,1);break;case 3:matrix.setRotate(180);break;case 4:matrix.setScale(1,-1);break;case 5:matrix.setRotate(90);matrix.postScale(-1,1);break;case 6:matrix.setRotate(90);break;case 7:matrix.setRotate(270);matrix.postScale(-1,1);break;case 8:matrix.setRotate(270);break;default:break;}
            if(!matrix.isIdentity()){android.graphics.Bitmap corrected=android.graphics.Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,true);if(corrected!=bitmap){bitmap.recycle();bitmap=corrected;}}
            java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG,82,out);
            if(out.size()>3500000)throw new java.io.IOException("Image too large");
            return "data:image/jpeg;base64,"+android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP);
        }finally{bitmap.recycle();}
    }
}
