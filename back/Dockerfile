FROM python:3.14-slim

WORKDIR /back

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

WORKDIR /back/src

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]