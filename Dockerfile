# 1. Use Node.js as the base
FROM node:18-slim

# 2. Install Python 3 and Build Tools
# We need this so Node.js can find the 'python3' command
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean

# 3. Create app directory
WORKDIR /app

# 4. Install Node dependencies
COPY package*.json ./
RUN npm install --production

# 5. Install Python dependencies (if any)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt || true

# 6. Copy the rest of the application code
COPY . .

# 7. Set environment variables
ENV NODE_ENV=production
# Render/Railway will provide the PORT automatically
ENV PORT=10000

# 8. Expose the port
EXPOSE 10000

# 9. Start the server
CMD ["node", "server.js"]