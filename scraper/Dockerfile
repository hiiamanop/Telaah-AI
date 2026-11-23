FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY scraper/requirements.txt ./scraper/requirements.txt
RUN pip install --no-cache-dir -r scraper/requirements.txt

COPY scraper ./scraper

EXPOSE 8001
CMD ["uvicorn", "scraper.app:app", "--host", "0.0.0.0", "--port", "8001"]
