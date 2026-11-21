/** Structure copied from the real IVAC OTP page (styling classes removed) */
const box = (i: number) =>
  `<input id="otp-${i}" type="text" inputmode="numeric" maxlength="1" autocomplete="off" value="">`;

export const IVAC_OTP_FORM = `
<form class="space-y-5">
  <h1>Verify OTP</h1>
  <label>OTP</label>
  <div>${box(0)}${box(1)}${box(2)}<span>-</span>${box(3)}${box(4)}${box(5)}</div>
  <button type="button" disabled>Resend OTP</button>
  <span>Resend in 1:40</span>
  <button disabled type="submit"><span>Verify OTP</span></button>
</form>`;