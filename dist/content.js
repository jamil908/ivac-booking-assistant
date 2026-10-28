console.log(`IVAC Assistant content script loaded`),chrome.runtime.onMessage.addListener((n,r,i)=>{switch(console.log(`Content script received message:`,n.type),n.type){case`PAGE_READY`:e(),i({success:!0});break;case`FILL_LOGIN`:t(n.payload),i({success:!0});break;default:i({success:!1,error:`Unknown message type`})}return!0});function e(){let e=window.location.href,t=window.location.pathname;console.log(`Detecting page type:`,e),(t.includes(`/login`)||document.querySelector(`input[type="password"]`))&&(console.log(`Login page detected`),r()),(t.includes(`/application`)||t.includes(`/form`))&&console.log(`Application form detected`),(t.includes(`/appointment`)||t.includes(`/booking`))&&console.log(`Booking page detected`),(t.includes(`/payment`)||t.includes(`/checkout`))&&console.log(`Payment page detected`)}function t(e){if(console.log(`Attempting to fill login form`),!e.username||!e.password){console.error(`Missing credentials`),i(`Missing credentials. Please update your profile.`,`error`);return}let t=document.querySelector(`input[type="email"], input[type="text"][name*="email"], input[name*="username"], input[id*="email"], input[id*="username"]`),r=document.querySelector(`input[type="password"]`);!t||!r?(console.error(`Login fields not found`),i(`Could not find login fields on this page`,`error`)):(setTimeout(()=>{t&&(t.value=e.username,t.dispatchEvent(new Event(`input`,{bubbles:!0})),t.dispatchEvent(new Event(`change`,{bubbles:!0})))},100),setTimeout(()=>{r&&(r.value=e.password,r.dispatchEvent(new Event(`input`,{bubbles:!0})),r.dispatchEvent(new Event(`change`,{bubbles:!0}))),i(`Login credentials filled. Review and submit manually.`,`success`),n()},300))}function n(){let e=document.querySelector(`button[type="submit"], input[type="submit"], button:has-text("login"), button:has-text("sign in")`);e&&(e.style.outline=`3px solid #10b981`,e.style.outlineOffset=`2px`,e.scrollIntoView({behavior:`smooth`,block:`center`}))}function r(){let e=document.createElement(`div`);e.id=`ivac-assistant-indicator`,e.innerHTML=`
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      IVAC Assistant Ready
    </div>
  `,document.body.appendChild(e),setTimeout(()=>{e.remove()},3e3)}function i(e,t=`info`){let n={success:`#10b981`,error:`#ef4444`,info:`#3b82f6`},r=document.createElement(`div`);r.innerHTML=`
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${n[t]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 300px;
    ">
      ${e}
    </div>
  `,document.body.appendChild(r),setTimeout(()=>{r.remove()},5e3)}function a(){document.querySelectorAll(`input[type="text"][maxlength="6"], input[type="number"][maxlength="6"], input[name*="otp"], input[id*="otp"]`).length>0&&(console.log(`OTP field detected`),i(`Please enter the OTP you received`,`info`))}e();var o=new MutationObserver(()=>{a()});o.observe(document.body,{childList:!0,subtree:!0}),window.addEventListener(`beforeunload`,()=>{o.disconnect()});