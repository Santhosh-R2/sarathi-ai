# 1. Use Node.js base
FROM node:18-slim

# 2. Install Python and Pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean

# 3. Set Working Directory
WORKDIR /app

# 4. Install Node Dependencies
COPY package*.json ./
RUN npm install --production

# 5. COPY and INSTALL Python Dependencies (CRITICAL FIX)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the code
COPY . .

# 7. Set