#!/bin/bash
rm -rf /var/www/SEACEchat/apps/web/node_modules
ln -s /var/www/SEACEchat/node_modules/.pnpm/node_modules /var/www/SEACEchat/apps/web/node_modules
echo "=== Next exists? ==="
ls /var/www/SEACEchat/apps/web/node_modules/next | head -3
echo "=== Restarting PM2 ==="
pm2 restart SEACEchat --env production
sleep 3
pm2 show SEACEchat | grep -E "status|restarts"
echo "=== Test port 3005 ==="
curl -s -o /dev/null -w "%{http_code}" http://localhost:3005/
