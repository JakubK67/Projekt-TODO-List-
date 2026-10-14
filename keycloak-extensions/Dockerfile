FROM maven:3.9-eclipse-temurin-21 AS provider
WORKDIR /build
COPY email-otp/pom.xml ./pom.xml
COPY email-otp/src ./src
RUN mvn -q -DskipTests package

FROM quay.io/keycloak/keycloak:26.0.8
COPY --from=provider /build/target/email-otp.jar /opt/keycloak/providers/email-otp.jar
RUN /opt/keycloak/bin/kc.sh build
