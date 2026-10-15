package pl.todo.keycloak;

import jakarta.ws.rs.core.MultivaluedMap;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationFlowModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.utils.KeycloakModelUtils;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.Config;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

public final class EmailOtpAuthenticator implements Authenticator {
    private static final String CODE = "emailOtp.code";
    private static final String EXPIRES = "emailOtp.expires";
    private static final String TRIES = "emailOtp.tries";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TTL_SECONDS = 300;
    private static final int MAX_TRIES = 5;

    @Override public void authenticate(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        if (user == null || user.getEmail() == null || user.getEmail().isBlank() || !user.isEmailVerified()) {
            context.failure(org.keycloak.authentication.AuthenticationFlowError.INVALID_USER);
            return;
        }
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        var auth = context.getAuthenticationSession();
        auth.setAuthNote(CODE, code);
        auth.setAuthNote(EXPIRES, Long.toString(System.currentTimeMillis() / 1000 + TTL_SECONDS));
        auth.setAuthNote(TRIES, "0");
        try {
            Map<String, String> smtp = new HashMap<>(context.getRealm().getSmtpConfig());
            putEnv(smtp, "host", "SMTP_HOST");
            putEnv(smtp, "port", "SMTP_PORT");
            putEnv(smtp, "from", "SMTP_FROM");
            putEnv(smtp, "auth", "SMTP_AUTH");
            putEnv(smtp, "starttls", "SMTP_STARTTLS");
            putEnv(smtp, "user", "SMTP_USER");
            putEnv(smtp, "password", "SMTP_PASSWORD");
            if (smtp.containsKey("host")) {
                context.getRealm().setSmtpConfig(smtp);
            }
            context.getRealm().setEmailTheme("todo-theme");
            context.getSession().getProvider(EmailTemplateProvider.class)
                .setRealm(context.getRealm()).setUser(user)
                .send("emailOtpSubject", "email-otp.ftl", Map.of("code", code));
            context.challenge(context.form().createForm("email-otp.ftl"));
        } catch (Exception e) {
            context.failureChallenge(org.keycloak.authentication.AuthenticationFlowError.INTERNAL_ERROR,
                context.form().setError("emailOtpSendError").createForm("email-otp.ftl"));
        }
    }

    private static void putEnv(Map<String, String> smtp, String key, String variable) {
        String value = System.getenv(variable);
        if (value != null && !value.isBlank()) {
            smtp.put(key, value);
        }
    }

    @Override public void action(AuthenticationFlowContext context) {
        var auth = context.getAuthenticationSession();
        long expires = Long.parseLong(auth.getAuthNote(EXPIRES) == null ? "0" : auth.getAuthNote(EXPIRES));
        int tries = Integer.parseInt(auth.getAuthNote(TRIES) == null ? "0" : auth.getAuthNote(TRIES));
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String submitted = form.getFirst("code");
        String expected = auth.getAuthNote(CODE);
        if (System.currentTimeMillis() / 1000 > expires || tries >= MAX_TRIES) {
            context.failureChallenge(org.keycloak.authentication.AuthenticationFlowError.INVALID_CREDENTIALS,
                context.form().setError("emailOtpExpired").createForm("email-otp.ftl"));
            return;
        }
        if (expected != null && submitted != null && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), submitted.trim().getBytes(StandardCharsets.UTF_8))) {
            auth.removeAuthNote(CODE); auth.removeAuthNote(EXPIRES); auth.removeAuthNote(TRIES);
            context.success();
            return;
        }
        auth.setAuthNote(TRIES, Integer.toString(tries + 1));
        context.failureChallenge(org.keycloak.authentication.AuthenticationFlowError.INVALID_CREDENTIALS,
            context.form().setError("emailOtpInvalid").createForm("email-otp.ftl"));
    }

    @Override public boolean requiresUser() { return true; }
    @Override public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) { return true; }
    @Override public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) { }
    @Override public void close() { }

    public static final class Factory implements AuthenticatorFactory {
        public static final String ID = "todo-email-otp";
        private static final EmailOtpAuthenticator SINGLETON = new EmailOtpAuthenticator();
        @Override public String getId() { return ID; }
        @Override public String getDisplayType() { return "TODO Email OTP"; }
        @Override public String getHelpText() { return "Send and verify a one-time code by email."; }
        @Override public String getReferenceCategory() { return "email-otp"; }
        @Override public boolean isConfigurable() { return false; }
        @Override public AuthenticationExecutionModel.Requirement[] getRequirementChoices() { return new AuthenticationExecutionModel.Requirement[]{AuthenticationExecutionModel.Requirement.REQUIRED, AuthenticationExecutionModel.Requirement.DISABLED}; }
        @Override public boolean isUserSetupAllowed() { return false; }
        @Override public Authenticator create(KeycloakSession session) { return SINGLETON; }
        @Override public void init(Config.Scope config) { }
        @Override public void postInit(KeycloakSessionFactory factory) {
            KeycloakModelUtils.runJobInTransaction(factory, session -> {
                RealmModel realm = session.realms().getRealmByName("todo-app");
                if (realm == null) {
                    return;
                }
                session.getContext().setRealm(realm);

                AuthenticationFlowModel forms = realm.getAuthenticationFlowsStream()
                    .filter(flow -> "forms".equals(flow.getAlias()))
                    .findFirst()
                    .orElse(null);
                if (forms != null && realm.getAuthenticationExecutionsStream(forms.getId())
                    .noneMatch(execution -> ID.equals(execution.getAuthenticator()))) {
                    AuthenticationExecutionModel execution = new AuthenticationExecutionModel();
                    execution.setAuthenticator(ID);
                    execution.setAuthenticatorFlow(false);
                    execution.setRequirement(AuthenticationExecutionModel.Requirement.REQUIRED);
                    execution.setPriority(15);
                    execution.setParentFlow(forms.getId());
                    realm.addAuthenticatorExecution(execution);
                }

                Map<String, String> smtp = new HashMap<>(realm.getSmtpConfig());
                putEnv(smtp, "host", "SMTP_HOST");
                putEnv(smtp, "port", "SMTP_PORT");
                putEnv(smtp, "from", "SMTP_FROM");
                putEnv(smtp, "auth", "SMTP_AUTH");
                putEnv(smtp, "starttls", "SMTP_STARTTLS");
                putEnv(smtp, "user", "SMTP_USER");
                putEnv(smtp, "password", "SMTP_PASSWORD");
                realm.setSmtpConfig(smtp);
                realm.setEmailTheme("todo-theme");
            });
        }
        @Override public void close() { }
    }
}
