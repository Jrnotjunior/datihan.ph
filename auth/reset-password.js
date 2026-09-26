document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('reset-form');
  const password=document.getElementById('password');
  const confirmPassword=document.getElementById('confirm-password');
  const message=document.getElementById('form-message');
  const button=form?.querySelector('button[type="submit"]');

  if(!form||!password||!confirmPassword||!message||!button)return;

  document.querySelectorAll('.password-toggle').forEach(toggle=>{
    toggle.addEventListener('click',()=>{
      const input=document.getElementById(toggle.dataset.target);
      if(!input)return;
      const showing=input.type==='text';
      input.type=showing?'password':'text';
      toggle.textContent=showing?'Show':'Hide';
      toggle.setAttribute('aria-label',showing?'Show password':'Hide password');
      toggle.setAttribute('aria-pressed',String(!showing));
    });
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    message.textContent='';
    message.className='form-message';

    if(password.value.length<8){
      message.textContent='Your new password must be at least 8 characters.';
      return;
    }

    if(password.value!==confirmPassword.value){
      message.textContent='The passwords do not match.';
      return;
    }

    if(!window.datihanSupabase){
      message.textContent='Password update is temporarily unavailable. Please try again shortly.';
      return;
    }

    button.disabled=true;
    button.setAttribute('aria-busy','true');
    message.textContent='Updating your password…';

    try{
      const {error}=await window.datihanSupabase.auth.updateUser({password:password.value});
      if(error)throw error;

      message.classList.add('form-message-success');
      message.textContent='Your password has been updated successfully. You can now sign in with your new password.';
      form.reset();
      setTimeout(()=>{window.location.href='login.html';},1500);
    }catch(error){
      console.error('Password update error:',error);
      message.textContent=error?.message||'Unable to update your password. Please request a new reset link and try again.';
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  });
});
