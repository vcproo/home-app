package com.jiatshenghuo.life;

import org.json.JSONObject;
import java.net.*;
import java.io.*;

final class BackendClient {
    static String endpoint(String value) throws Exception {
        URI uri=new URI(value.trim());
        if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)throw new Exception("请填写HTTPS服务地址");
        return value.trim().replaceAll("/+$","");
    }
    static JSONObject request(JSONObject config,String path,String method,String body) throws Exception {
        if(!path.matches("/api/(data|health|logout|legacy-backup|address-photos(/[a-f0-9]{32})?|auth/(login|register)|family/(invite|join|create))")||!method.matches("GET|POST|PUT"))throw new Exception("请求不受支持");
        HttpURLConnection connection=(HttpURLConnection)new URL(endpoint(config.optString("endpoint","https://localhost:8787"))+path).openConnection();
        try {
            connection.setInstanceFollowRedirects(false);connection.setRequestMethod(method);connection.setConnectTimeout(60000);connection.setReadTimeout(60000);
            connection.setRequestProperty("Content-Type","application/json");
            if(!config.optString("token").isEmpty())connection.setRequestProperty("Authorization","Bearer "+config.getString("token"));
            if(!method.equals("GET")){
                byte[] bytes=body.getBytes(java.nio.charset.StandardCharsets.UTF_8);if(bytes.length>4*1024*1024)throw new Exception("数据过大，请先导出归档");
                connection.setDoOutput(true);connection.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=connection.getOutputStream()){out.write(bytes);}
            }
            int status=connection.getResponseCode();InputStream source=status<400?connection.getInputStream():connection.getErrorStream();
            if(source==null)throw new IOException("No response");
            try(InputStream in=source;ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){if(out.size()+n>5*1024*1024)throw new IOException("Response too large");out.write(buffer,0,n);}
                JSONObject response=new JSONObject(out.toString("UTF-8"));
                return new JSONObject().put("status",status).put("data",response);
            }
        }finally{connection.disconnect();}
    }
}
