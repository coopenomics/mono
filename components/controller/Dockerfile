# Базовый образ Node.js на Debian slim
FROM node:22-slim

# Включение pnpm
# Устанавливаем pnpm без использования corepack
RUN npm install -g pnpm@8.15.4

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json
COPY package.json ./

# Установка системных зависимостей для WeasyPrint и создание виртуального окружения
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    gcc \
    g++ \
    python3-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    libffi-dev \
    libharfbuzz-dev \
    libcairo2 \
    libpango1.0-dev \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /venv \
    && /venv/bin/pip install WeasyPrint==67 \
    && rm -rf /root/.cache/pip

# Шрифт Arial устанавливаем СИСТЕМНО (а не встраиваем base64 в каждый html).
# Иначе weasyprint парсил бы ~270 КБ TTF на каждый рендер (≈1.3 сек/документ).
# Системный шрифт fontconfig парсит один раз и кеширует. Файл тот же —
# глифы/вёрстка идентичны прежним.
COPY assets/fonts/arial.ttf /usr/share/fonts/truetype/arial/arial.ttf
RUN fc-cache -f && fc-match Arial

# Установка пути к виртуальному окружению в PATH
ENV PATH="/venv/bin:$PATH"

# Проверка наличия команды weasyprint
RUN weasyprint --version

# CMD для запуска weasyprint
# CMD ["weasyprint", "input.html", "output.pdf"]
