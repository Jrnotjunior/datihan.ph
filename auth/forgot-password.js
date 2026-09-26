document.addEventListener('DOMContentLoaded',()=>{
  const form=document.getElementById('forgot-form');
  const email=document.getElementById('email');
  const message=document.getElementById('form-message');
  const button=form?.querySelector('button[type="submit"]');

  if(!form||!email||!message||!button)return;

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    message.textContent='';
    message.className='form-message';

    const address=email.value.trim();
    if(!address){
      message.textContent='Please enter your email address.';
      return;
    }

    if(!email.validity.valid){
      message.textContent='Please enter a valid email address.';
      return;
    }

    if(!window.datihanSupabase){
      message.textContent='Password reset is temporarily unavailable. Please try again shortly.';
      return;
    }

    button.disabled=true;
    button.setAttribute('aria-busy','true');
    message.textContent='Sending reset link…';

    try{
      const redirectTo=new URL('reset-password.html',window.location.href).href;
      const {error}=await window.datihanSupabase.auth.resetPasswordForEmail(address,{redirectTo});
      if(error)throw error;

      message.classList.add('form-message-success');
      message.textContent='If an account exists for this email, a password reset link has been sent. Please check your inbox.';
      form.reset();
    }catch(error){
      console.error('Password reset error:',error);
      message.textContent=error?.message||'Unable to send the reset link. Please try again.';
    }finally{
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  });
});
