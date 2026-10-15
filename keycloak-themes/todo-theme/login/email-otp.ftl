<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=true; section>
  <#if section == "header">Kod weryfikacyjny
  <#elseif section == "form">
    <p>Wys³aliœmy jednorazowy kod na adres e-mail przypisany do konta. Kod jest wa¿ny przez 5 minut.</p>
    <form id="kc-email-otp-form" action="${url.loginAction}" method="post">
      <label for="code">Kod z e-maila</label>
      <input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required autofocus />
      <input class="pf-c-button pf-m-primary pf-m-block btn-lg" type="submit" value="PotwierdŸ" />
    </form>
  </#if>
</@layout.registrationLayout>
