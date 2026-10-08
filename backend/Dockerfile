# Use a slim Python image to save disk space and RAM
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI code 
COPY . .

# Expose port 8000 for Nginx to proxy to
EXPOSE 8000

# Launch Uvicorn on 0.0.0.0 to allow Docker to map the port externally
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
