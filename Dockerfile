# 1. Use Node.js base
FROM node:18-slim

# 2. Install Python, Pip, and ensure we have build tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-full && \
    apt-get clean

# 3. Set Working Directory
WORKDIR /app

# 4. Install Node Dependencies
COPY package*.json ./
RUN npm install --production

# 5. COPY and INSTALL Python Dependencies (FIXED LINE)
COPY requirements.txt ./
# We add --break-system-packages because we are in an isolated Docker container
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# 6. Copy the rest of the code
COPY . .

# 7. Set Port and Start
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
