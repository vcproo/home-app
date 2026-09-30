package com.jiatshenghuo.life;

import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URI;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

final class FoodVisionClient {
    private volatile HttpURLConnection active;
    private volatile boolean cancelled;
    static String endpoint(String base) throws Exception {
        URI uri=new URI(base.trim());
        if(!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost()==null || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null)throw new Exception("请填写有效的 HTTPS 接口地址");
        String path=uri.getPath().replaceAll("/+$","");
        if(!path.endsWith("/chat/completions"))path+="/chat/completions";
        return new URI(uri.getScheme(),null,uri.getHost(),uri.getPort(),path,null,null).toString();
    }
    void cancel(){cancelled=true;HttpURLConnection connection=active;if(connection!=null)connection.disconnect();}
    String request(JSONObject config,JSONObject body) throws Exception {
        if(cancelled)throw new Exception("识别已取消");
        if(config.optString("model").isEmpty())throw new Exception("请先配置视觉模型");
        body.put("model",config.getString("model"));body.put("stream",false);
        byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);
        if(data.length>6*1024*1024)throw new Exception("图片过大，请重新选择");
        HttpURLConnection connection=(HttpURLConnection)new URI(endpoint(config.getString("endpoint"))).toURL().openConnection();active=connection;
        try {
            if(cancelled)throw new Exception("识别已取消");
            connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setConnectTimeout(60000);connection.setReadTimeout(60000);
            connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
            if(!config.optString("apiKey").isEmpty())connection.setRequestProperty("Authorization","Bearer "+config.getString("apiKey"));
            connection.setFixedLengthStreamingMode(data.length);
            try(java.io.OutputStream out=connection.getOutputStream()){out.write(data);}
            int status=connection.getResponseCode();
            if(status<200 || status>=300){
                if(status==401 || status==403)throw new Exception("接口鉴权失败，请检查密钥或模型权限");
                if(status==429)throw new Exception("服务限流或额度不足，请稍后重试");
                throw new Exception("识别服务返回 "+status+"，请检查地址与模型配置");
            }
            try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(cancelled)throw new Exception("识别已取消");if(out.size()+n>1024*1024)throw new Exception("模型返回内容过大");out.write(buffer,0,n);}
                return out.toString("UTF-8");
            }
        } finally{connection.disconnect();active=null;}
    }
}
