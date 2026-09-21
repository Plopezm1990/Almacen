(function(){
  "use strict";
  var SUPABASE_URL="https://flqercbgpgmmfaakrwkc.supabase.co";
  var ANON_KEY="sb_publishable_dDpJoqnVG8Axmk2QqCCX1g_4h5keXWJ";
  var accessToken=null;

  var solicitar=document.getElementById("solicitar");
  var cambiar=document.getElementById("cambiar");
  var final=document.getElementById("final");
  var intro=document.getElementById("intro");
  var email=document.getElementById("email");
  var enviar=document.getElementById("enviar");
  var guardar=document.getElementById("guardar");
  var pass1=document.getElementById("pass1");
  var pass2=document.getElementById("pass2");
  var msgEnviar=document.getElementById("msgEnviar");
  var msgGuardar=document.getElementById("msgGuardar");

  function mensaje(el,texto,error){el.textContent=texto||"";el.className="msg"+(error?" error":"");}
  function limpiarTokenURL(){try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
  function leerHash(){
    var h=(location.hash||"").replace(/^#/,"");
    if(!h)return {};
    var p=new URLSearchParams(h);
    var o={};p.forEach(function(v,k){o[k]=v;});return o;
  }

  var hash=leerHash();
  if(hash.error_description){
    mensaje(msgEnviar,decodeURIComponent(hash.error_description),true);
    limpiarTokenURL();
  }else if(hash.access_token && (hash.type==="recovery" || hash.refresh_token)){
    accessToken=hash.access_token;
    limpiarTokenURL();
    solicitar.classList.add("hidden");
    cambiar.classList.remove("hidden");
    intro.textContent="El enlace es válido. Elige ahora una contraseña nueva para esta cuenta.";
    setTimeout(function(){pass1.focus();},50);
  }

  enviar.addEventListener("click",async function(){
    var correo=(email.value||"").trim();
    if(!correo){mensaje(msgEnviar,"Escribe el correo de la cuenta.",true);email.focus();return;}
    enviar.disabled=true;mensaje(msgEnviar,"Enviando…",false);
    try{
      var redirect=location.origin+location.pathname;
      var r=await fetch(SUPABASE_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirect),{
        method:"POST",
        headers:{"apikey":ANON_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({email:correo})
      });
      var data={};try{data=await r.json();}catch(e){}
      if(!r.ok)throw new Error(data.msg||data.message||data.error_description||"No se pudo enviar el correo.");
      mensaje(msgEnviar,"Si la cuenta existe, recibirás un correo de recuperación. Ábrelo en este mismo navegador.",false);
    }catch(e){mensaje(msgEnviar,e&&e.message?e.message:"No se pudo enviar el correo.",true);}finally{enviar.disabled=false;}
  });

  guardar.addEventListener("click",async function(){
    var p1=pass1.value||"",p2=pass2.value||"";
    if(!accessToken){mensaje(msgGuardar,"El enlace de recuperación ya no es válido. Solicita uno nuevo.",true);return;}
    if(p1.length<8){mensaje(msgGuardar,"Usa al menos 8 caracteres.",true);pass1.focus();return;}
    if(p1!==p2){mensaje(msgGuardar,"Las dos contraseñas no coinciden.",true);pass2.focus();return;}
    guardar.disabled=true;mensaje(msgGuardar,"Guardando…",false);
    try{
      var r=await fetch(SUPABASE_URL+"/auth/v1/user",{
        method:"PUT",
        headers:{"apikey":ANON_KEY,"Authorization":"Bearer "+accessToken,"Content-Type":"application/json"},
        body:JSON.stringify({password:p1})
      });
      var data={};try{data=await r.json();}catch(e){}
      if(!r.ok)throw new Error(data.msg||data.message||data.error_description||"No se pudo actualizar la contraseña.");
      accessToken=null;pass1.value="";pass2.value="";
      cambiar.classList.add("hidden");final.classList.remove("hidden");
      intro.textContent="Acceso recuperado.";
    }catch(e){mensaje(msgGuardar,e&&e.message?e.message:"No se pudo actualizar la contraseña.",true);guardar.disabled=false;}
  });
})();
