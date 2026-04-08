FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN set -eux; \
    for i in 1 2 3 4 5; do \
      mvn dependency:go-offline -B && break; \
      echo "Maven go-offline failed (attempt $i), retrying..."; \
      sleep 10; \
    done
COPY src ./src
RUN set -eux; \
    for i in 1 2 3 4 5; do \
      mvn clean package -DskipTests && break; \
      echo "Maven package failed (attempt $i), retrying..."; \
      sleep 10; \
    done

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Копируем папку uploads/appliances для инициализации тестовых данных
COPY uploads ./uploads
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]











