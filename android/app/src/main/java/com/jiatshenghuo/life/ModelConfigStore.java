package com.jiatshenghuo.life;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device-local model configuration encrypted by a non-exportable Android key. */
final class ModelConfigStore {
    private final String alias;
    private final String preferences;
    private final Context context;
    ModelConfigStore(Context context) { this(context,"model-config"); }
    ModelConfigStore(Context context,String preferences) { this.context = context; this.preferences=preferences;this.alias="family-life-"+preferences; }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(alias)) return (SecretKey) store.getKey(alias,null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    synchronized JSONObject read() throws Exception {
        String saved = context.getSharedPreferences(preferences,Context.MODE_PRIVATE).getString("encrypted",null);
        if (saved == null) return new JSONObject();
        JSONObject envelope = new JSONObject(saved);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(envelope.getString("iv"),Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("data"),Base64.NO_WRAP)),StandardCharsets.UTF_8));
    }
    synchronized void write(JSONObject value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key());
        JSONObject envelope = new JSONObject();
        envelope.put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP));
        envelope.put("data",Base64.encodeToString(cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP));
        if (!context.getSharedPreferences(preferences,Context.MODE_PRIVATE).edit().putString("encrypted",envelope.toString()).commit()) throw new java.io.IOException("Save failed");
    }
    synchronized void clear() {
        context.getSharedPreferences(preferences,Context.MODE_PRIVATE).edit().clear().commit();
    }
}
