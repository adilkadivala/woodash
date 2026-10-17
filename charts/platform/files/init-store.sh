#!/bin/sh
# Idempotent WooCommerce bootstrap: core, plugin, COD, REST API key, sample product.
# Used by Docker Compose and the Helm wp-init Job. Runs against /var/www/html.
set -eu

# wordpress:cli as uid 33 has HOME=/; WP-CLI then cannot mkdir /.wp-cli/cache.
export HOME="${HOME:-/tmp}"
export WP_CLI_CACHE_DIR="${WP_CLI_CACHE_DIR:-/tmp/.wp-cli/cache}"
mkdir -p "$WP_CLI_CACHE_DIR"

cd /var/www/html

WP="wp --path=/var/www/html"
# wordpress:cli runs as www-data; if we are root, allow it.
if [ "$(id -u)" = "0" ]; then
  WP="$WP --allow-root"
fi

echo "[wp-init] waiting for WordPress files on the volume..."
i=0
while [ "$i" -lt 60 ]; do
  if [ -f /var/www/html/wp-includes/version.php ]; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
if [ ! -f /var/www/html/wp-includes/version.php ]; then
  echo "[wp-init] WordPress core files never appeared on the PVC" >&2
  exit 1
fi

echo "[wp-init] waiting for database..."
i=0
while [ "$i" -lt 60 ]; do
  if $WP db check >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 3
done
$WP db check

if ! $WP core is-installed >/dev/null 2>&1; then
  echo "[wp-init] installing WordPress at ${WP_URL}..."
  $WP core install \
    --url="${WP_URL}" \
    --title="${WP_TITLE:-Demo Store}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email
fi

# Pin Woo: latest 11.x requires WordPress 7.0; this stack uses 6.7.2.
WOO_PLUGIN_VERSION="${WOO_PLUGIN_VERSION:-9.9.5}"
echo "[wp-init] ensuring WooCommerce ${WOO_PLUGIN_VERSION}..."
if ! $WP plugin is-installed woocommerce >/dev/null 2>&1; then
  $WP plugin install woocommerce --version="${WOO_PLUGIN_VERSION}" --activate
fi
if ! $WP plugin is-active woocommerce >/dev/null 2>&1; then
  $WP plugin activate woocommerce
fi

# Create shop pages (cart, checkout, shop, my-account)
$WP wc --user=1 tool run install_pages >/dev/null 2>&1 || true

$WP option update woocommerce_coming_soon "no" >/dev/null
$WP option update woocommerce_store_pages_only "no" >/dev/null 2>&1 || true
$WP option update woocommerce_show_marketplace_suggestions "no" >/dev/null 2>&1 || true
$WP option update woocommerce_allow_tracking "no" >/dev/null 2>&1 || true
$WP option update woocommerce_currency "USD" >/dev/null
$WP option update woocommerce_cod_settings --format=json \
  '{"enabled":"yes","title":"Cash on delivery","description":"Pay with cash upon delivery.","instructions":"Pay with cash.","enable_for_virtual":"yes"}' \
  >/dev/null

$WP rewrite structure "/%postname%/" --hard >/dev/null
$WP rewrite flush --hard >/dev/null

# WooCommerce only runs consumer-key Basic/query auth when is_ssl() is true.
# MCP talks HTTP to WordPress (Compose port 80 and in-cluster ClusterIP).
echo "[wp-init] installing mu-plugin for Woo REST auth over HTTP..."
MU_DIR=/var/www/html/wp-content/mu-plugins
mkdir -p "$MU_DIR"
if [ ! -w "$MU_DIR" ]; then
  echo "[wp-init] $MU_DIR is not writable; leaving existing mu-plugin in place"
else
cat > "$MU_DIR/wc-rest-http-auth.php" <<'PHP'
<?php
/**
 * Plugin Name: Woo REST auth over HTTP
 * Description: Allow Woo REST consumer-key auth when WordPress is served over HTTP.
 */
add_filter(
	'determine_current_user',
	static function ( $user_id ) {
		if ( ! empty( $user_id ) ) {
			return $user_id;
		}
		$uri = $_SERVER['REQUEST_URI'] ?? '';
		if ( $uri === '' || ( false === strpos( $uri, '/wp-json/wc/' ) && false === strpos( $uri, '/wp-json/wc-' ) ) ) {
			return $user_id;
		}
		$_SERVER['HTTPS'] = 'on';
		return $user_id;
	},
	5
);
PHP
fi

echo "[wp-init] ensuring REST API key..."
$WP eval '
$consumer_key = getenv("WOO_CONSUMER_KEY");
$consumer_secret = getenv("WOO_CONSUMER_SECRET");
if (!$consumer_key || !$consumer_secret) {
  fwrite(STDERR, "WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET missing\n");
  exit(1);
}
if (!function_exists("wc_api_hash")) {
  fwrite(STDERR, "WooCommerce not loaded\n");
  exit(1);
}
global $wpdb;
$table = $wpdb->prefix . "woocommerce_api_keys";
if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table)) !== $table) {
  fwrite(STDERR, "woocommerce_api_keys table missing — plugin not installed?\n");
  exit(1);
}
$truncated = substr($consumer_key, -7);
$existing = $wpdb->get_var($wpdb->prepare("SELECT key_id FROM {$table} WHERE truncated_key = %s", $truncated));
if ($existing) {
  echo "REST key already present\n";
  exit(0);
}
$wpdb->insert($table, array(
  "user_id" => 1,
  "description" => "MCP Gateway",
  "permissions" => "read_write",
  "consumer_key" => wc_api_hash($consumer_key),
  "consumer_secret" => $consumer_secret,
  "truncated_key" => $truncated,
));
echo "REST key inserted\n";
'

COUNT=$($WP post list --post_type=product --post_status=publish --format=count 2>/dev/null || echo 0)
if [ "$COUNT" = "0" ]; then
  echo "[wp-init] creating sample product..."
  $WP wc --user=1 product create \
    --name="Starter Tee" \
    --regular_price="19.99" \
    --type=simple \
    --status=publish >/dev/null 2>&1 || true
fi

echo "[wp-init] store ready"
