/**
 * Module d'interrogation On-Chain pour blockchains publiques :
 * - Ethereum (ETH) via RPC Cloudflare
 * - Bitcoin (BTC) via Mempool.space (Adresses et xpub/zpub)
 * - Dogecoin (DOGE) via BlockCypher
 * - XRP (Ripple) via XRPL Cluster (s1.ripple.com)
 */

export interface OnChainAddressQuery {
  eth?: string;
  btc?: string;
  doge?: string;
  xrp?: string;
}

export interface OnChainBalanceResult {
  symbol: "ETH" | "BTC" | "DOGE" | "XRP" | string;
  blockchain: string;
  address: string;
  shortAddress: string;
  balance: number;
  unit: string;
  formattedBalance: string;
  priceEur?: number;
  totalValueEur?: number;
  error?: string;
  syncDate: string;
}

/**
 * Abrège une adresse pour un affichage propre (ex: 0x12...ab, bc1q...xy, r...)
 */
export function formatShortAddress(address: string, leadChars = 6, trailChars = 4): string {
  if (!address) return "";
  const trimmed = address.trim();
  if (trimmed.length <= leadChars + trailChars + 3) return trimmed;
  return `${trimmed.slice(0, leadChars)}...${trimmed.slice(-trailChars)}`;
}

const DEFAULT_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/**
 * 1. Ethereum (ETH) via RPC (Cloudflare avec fallbacks LlamaRPC et PublicNode)
 * POST https://cloudflare-eth.com
 * Hex Wei -> Décimal -> Divisé par 10^18
 */
export async function fetchEthBalance(address: string): Promise<number> {
  const cleanAddr = address.trim();

  const rpcEndpoints = [
    "https://cloudflare-eth.com",
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
  ];

  for (const rpc of rpcEndpoints) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: {
          ...DEFAULT_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [cleanAddr, "latest"],
          id: 1,
        }),
        cache: "no-store",
      });

      if (!res.ok) continue;

      const json = await res.json();
      if (json.error) continue;

      const hexWei = json.result;
      if (!hexWei || typeof hexWei !== "string") return 0;

      const weiBigInt = BigInt(hexWei);
      const divisor = BigInt("1000000000000000000"); // 10^18
      const integerPart = weiBigInt / divisor;
      const remainder = weiBigInt % divisor;

      return Number(integerPart) + Number(remainder) / 1e18;
    } catch {
      // essayer le RPC suivant
    }
  }

  throw new Error("Tous les RPC Ethereum ont échoué");
}


import { HDKey } from "@scure/bip32";
import { base58check, bech32, bech32m } from "@scure/base";
import crypto from "crypto";

// Helpers cryptographiques pour dérivation d'adresses
function sha256(buf: Uint8Array | Buffer): Buffer {
  return crypto.createHash("sha256").update(buf).digest();
}

function ripemd160(buf: Uint8Array | Buffer): Buffer {
  return crypto.createHash("ripemd160").update(buf).digest();
}

function hash160(buf: Uint8Array | Buffer): Buffer {
  return ripemd160(sha256(buf));
}

// Convertisseurs clés publiques vers adresses
function pubKeyToP2PKH(pubKey: Uint8Array, versionByte = 0x00): string {
  const pkh = hash160(pubKey);
  const payload = Buffer.concat([Buffer.from([versionByte]), pkh]);
  return base58check(sha256).encode(payload);
}

function pubKeyToDogeP2PKH(pubKey: Uint8Array): string {
  return pubKeyToP2PKH(pubKey, 0x1e); // 0x1e = 30 ('D')
}

function pubKeyToP2WPKH(pubKey: Uint8Array): string {
  const pkh = hash160(pubKey);
  const words = bech32.toWords(pkh);
  return bech32.encode("bc", [0, ...words]);
}

function pubKeyToP2SH_P2WPKH(pubKey: Uint8Array): string {
  const pkh = hash160(pubKey);
  const redeemScript = Buffer.concat([Buffer.from([0x00, 0x14]), pkh]);
  const scriptHash = hash160(redeemScript);
  const payload = Buffer.concat([Buffer.from([0x05]), scriptHash]);
  return base58check(sha256).encode(payload);
}

function pubKeyToP2TR(pubKey: Uint8Array): string {
  const xOnly = pubKey.slice(1);
  const words = bech32m.toWords(xOnly);
  return bech32m.encode("bc", [1, ...words]);
}

/**
 * 2. Bitcoin (BTC) via Blockchain.info, Trezor Blockbook, Mempool.space & Dérivation HD
 * Compatible avec les adresses simples et clés étendues xpub/ypub/zpub
 */
export async function fetchBtcBalance(addressOrXpub: string): Promise<number> {
  const clean = addressOrXpub.trim();
  const isExtended =
    clean.startsWith("xpub") ||
    clean.startsWith("ypub") ||
    clean.startsWith("zpub") ||
    clean.startsWith("vpub") ||
    clean.startsWith("upub");

  // 1. Si adresse simple : Mempool.space en priorité + Blockchain.info
  if (!isExtended) {
    try {
      const mempoolUrl = `https://mempool.space/api/address/${encodeURIComponent(clean)}`;
      const res = await fetch(mempoolUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const chainStats = json.chain_stats || {};
        const mempoolStats = json.mempool_stats || {};
        const funded = (chainStats.funded_txo_sum || 0) + (mempoolStats.funded_txo_sum || 0);
        const spent = (chainStats.spent_txo_sum || 0) + (mempoolStats.spent_txo_sum || 0);
        return Math.max(0, (funded - spent) / 1e8);
      }
    } catch {}

    try {
      const bcUrl = `https://blockchain.info/rawaddr/${encodeURIComponent(clean)}?limit=0`;
      const res = await fetch(bcUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.final_balance !== undefined) {
          return Math.max(0, Number(json.final_balance) / 1e8);
        }
      }
    } catch {}
  }

  // 2. Si clé étendue (xpub/ypub/zpub) : Trezor Blockbook API
  if (isExtended) {
    const trezorHosts = ["https://btc1.trezor.io", "https://btc2.trezor.io"];
    for (const host of trezorHosts) {
      try {
        const trezorUrl = `${host}/api/v2/xpub/${encodeURIComponent(clean)}?tokens=nonzero`;
        const res = await fetch(trezorUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json.balance !== undefined) {
            const satoshis = Number(json.balance);
            return Math.max(0, satoshis / 1e8);
          }
        }
      } catch {}
    }

    // 3. Dérivation HD locale complète (Native SegWit, Nested SegWit, Legacy, Taproot)
    try {
      let standardXpub = clean;
      if (!clean.startsWith("xpub")) {
        const raw = base58check(sha256).decode(clean);
        const xpubBytes = Buffer.concat([Buffer.from("0488b21e", "hex"), raw.slice(4)]);
        standardXpub = base58check(sha256).encode(xpubBytes);
      }

      const hdKey = HDKey.fromExtendedKey(standardXpub);
      const derivedAddresses: string[] = [];

      // Dérive les 20 premières adresses de réception et 10 adresses de change
      for (const change of [0, 1]) {
        const count = change === 0 ? 20 : 10;
        for (let i = 0; i < count; i++) {
          const child = hdKey.deriveChild(change).deriveChild(i);
          if (!child.publicKey) continue;
          derivedAddresses.push(pubKeyToP2WPKH(child.publicKey)); // bc1q...
          derivedAddresses.push(pubKeyToP2SH_P2WPKH(child.publicKey)); // 3...
          derivedAddresses.push(pubKeyToP2PKH(child.publicKey)); // 1...
          derivedAddresses.push(pubKeyToP2TR(child.publicKey)); // bc1p...
        }
      }

      // Interrogation groupée par paquets de 40 adresses via Blockchain.info multiaddr
      let totalBtc = 0;
      let hasData = false;

      for (let i = 0; i < derivedAddresses.length; i += 40) {
        const chunk = derivedAddresses.slice(i, i + 40);
        const multiUrl = `https://blockchain.info/multiaddr?active=${encodeURIComponent(chunk.join("|"))}&n=0`;
        const res = await fetch(multiUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          hasData = true;
          for (const addrObj of data.addresses || []) {
            if (addrObj.final_balance > 0) {
              totalBtc += Number(addrObj.final_balance) / 1e8;
            }
          }
        }
      }

      if (hasData) {
        return totalBtc;
      }
    } catch {}

    // Fallback direct Blockchain.info xpub
    try {
      const bcUrl = `https://blockchain.info/rawxpub/${encodeURIComponent(clean)}?limit=0`;
      const res = await fetch(bcUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.final_balance !== undefined) {
          return Math.max(0, Number(json.final_balance) / 1e8);
        }
      }
    } catch {}
  }

  return 0;
}

/**
 * 3. Dogecoin (DOGE) via BlockCypher, Dérivation HD (dgub/xpub), Blockbook & Cryptoid
 * Compatible avec les adresses simples (D...) et les clés étendues (dgub... / xpub...)
 */
export async function fetchDogeBalance(addressOrXpub: string): Promise<number> {
  const cleanAddr = addressOrXpub.trim();
  const isExtended =
    cleanAddr.startsWith("dgub") ||
    cleanAddr.startsWith("xpub") ||
    cleanAddr.startsWith("dgpv");

  // 1. Clé étendue Dogecoin (dgub / xpub) -> Dérivation HD locale des adresses + BlockCypher
  if (isExtended) {
    try {
      let standardXpub = cleanAddr;
      if (cleanAddr.startsWith("dgub") || cleanAddr.startsWith("dgpv")) {
        const raw = base58check(sha256).decode(cleanAddr);
        const xpubBytes = Buffer.concat([Buffer.from("0488b21e", "hex"), raw.slice(4)]);
        standardXpub = base58check(sha256).encode(xpubBytes);
      }

      const hdKey = HDKey.fromExtendedKey(standardXpub);
      const derivedAddresses: string[] = [];

      // Dérive les 20 adresses de réception et 10 de change (BIP44 Dogecoin standard)
      for (const change of [0, 1]) {
        const count = change === 0 ? 20 : 10;
        for (let i = 0; i < count; i++) {
          const child = hdKey.deriveChild(change).deriveChild(i);
          if (!child.publicKey) continue;
          derivedAddresses.push(pubKeyToDogeP2PKH(child.publicKey));
        }
      }

      let totalDoge = 0;
      let successfulChecks = 0;

      // Vérifie les adresses dérivées
      for (const addr of derivedAddresses) {
        try {
          const bcUrl = `https://api.blockcypher.com/v1/doge/main/addrs/${encodeURIComponent(addr)}/balance`;
          const res = await fetch(bcUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
          if (res.ok) {
            const json = await res.json();
            successfulChecks++;
            const bal = Number(json.balance || 0) / 1e8;
            if (bal > 0) {
              totalDoge += bal;
            }
            continue;
          }
        } catch {}

        // Fallback Cryptoid par adresse
        try {
          const cryptoidUrl = `https://chainz.cryptoid.info/doge/api.dws?q=getbalance&a=${encodeURIComponent(addr)}`;
          const res = await fetch(cryptoidUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            const bal = parseFloat(text);
            if (!isNaN(bal)) {
              successfulChecks++;
              if (bal > 0) {
                totalDoge += bal;
              }
            }
          }
        } catch {}
      }

      if (successfulChecks > 0) {
        return totalDoge;
      }
    } catch {}
  }

  // 2. Adresse simple Dogecoin (D...)
  if (!isExtended) {
    // A. BlockCypher
    try {
      const bcUrl = `https://api.blockcypher.com/v1/doge/main/addrs/${encodeURIComponent(cleanAddr)}/balance`;
      const res = await fetch(bcUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.balance !== undefined) {
          return Math.max(0, Number(json.balance) / 1e8);
        }
      }
    } catch {}

    // B. Cryptoid
    try {
      const cryptoidUrl = `https://chainz.cryptoid.info/doge/api.dws?q=getbalance&a=${encodeURIComponent(cleanAddr)}`;
      const res = await fetch(cryptoidUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        const bal = parseFloat(text);
        if (!isNaN(bal)) {
          return Math.max(0, bal);
        }
      }
    } catch {}

    // C. Dogechain
    try {
      const dogechainUrl = `https://dogechain.info/api/v1/address/balance/${encodeURIComponent(cleanAddr)}`;
      const res = await fetch(dogechainUrl, { headers: DEFAULT_HEADERS, cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.balance !== undefined) {
          const parsed = typeof json.balance === "number" ? json.balance : parseFloat(json.balance);
          if (!isNaN(parsed)) {
            return Math.max(0, parsed);
          }
        }
      }
    } catch {}
  }

  return 0;
}





/**
 * 4. XRP (Ripple) via XRPL Public Cluster
 * POST https://s1.ripple.com:51234/
 * Body: {"method":"account_info","params":[{"account":"<ADRESSE>","ledger_index":"validated"}]}
 * Solde = result.account_data.Balance / 10^6
 */
export async function fetchXrpBalance(address: string): Promise<number> {
  const cleanAddr = address.trim();

  const xrplEndpoints = [
    "https://s1.ripple.com:51234/",
    "https://xrplcluster.com/",
    "https://s2.ripple.com:51234/",
  ];

  for (const endpoint of xrplEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...DEFAULT_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "account_info",
          params: [
            {
              account: cleanAddr,
              ledger_index: "validated",
            },
          ],
        }),
        cache: "no-store",
      });

      if (!res.ok) continue;

      const json = await res.json();

      if (json.result?.error === "actNotFound") {
        return 0;
      }

      if (json.result?.error) {
        continue;
      }

      const drops = Number(json.result?.account_data?.Balance || 0);
      return Math.max(0, drops / 1e6);
    } catch {
      // essayer le cluster suivant
    }
  }

  throw new Error(`Impossible de récupérer le solde XRP pour ${cleanAddr}`);
}



/**
 * Agrégateur On-Chain multi-adresses
 */
export async function fetchAllOnChainBalances(
  queries: OnChainAddressQuery
): Promise<OnChainBalanceResult[]> {
  const results: OnChainBalanceResult[] = [];
  const now = new Date();
  const syncDate = now.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const promises: Promise<void>[] = [];

  // ETH
  if (queries.eth) {
    promises.push(
      (async () => {
        try {
          const bal = await fetchEthBalance(queries.eth!);
          results.push({
            symbol: "ETH",
            blockchain: "Ethereum",
            address: queries.eth!,
            shortAddress: formatShortAddress(queries.eth!, 6, 4),
            balance: bal,
            unit: "ETH",
            formattedBalance: `${bal.toLocaleString("fr-FR", { maximumFractionDigits: 6 })} ETH`,
            syncDate,
          });
        } catch (err: unknown) {
          results.push({
            symbol: "ETH",
            blockchain: "Ethereum",
            address: queries.eth!,
            shortAddress: formatShortAddress(queries.eth!, 6, 4),
            balance: 0,
            unit: "ETH",
            formattedBalance: "0.0000 ETH",
            error: (err as Error).message,
            syncDate,
          });
        }
      })()
    );
  }

  // BTC
  if (queries.btc) {
    promises.push(
      (async () => {
        try {
          const bal = await fetchBtcBalance(queries.btc!);
          results.push({
            symbol: "BTC",
            blockchain: "Bitcoin",
            address: queries.btc!,
            shortAddress: formatShortAddress(queries.btc!, 6, 4),
            balance: bal,
            unit: "BTC",
            formattedBalance: `${bal.toLocaleString("fr-FR", { maximumFractionDigits: 6 })} BTC`,
            syncDate,
          });
        } catch (err: unknown) {
          results.push({
            symbol: "BTC",
            blockchain: "Bitcoin",
            address: queries.btc!,
            shortAddress: formatShortAddress(queries.btc!, 6, 4),
            balance: 0,
            unit: "BTC",
            formattedBalance: "0.0000 BTC",
            error: (err as Error).message,
            syncDate,
          });
        }
      })()
    );
  }

  // DOGE
  if (queries.doge) {
    promises.push(
      (async () => {
        try {
          const bal = await fetchDogeBalance(queries.doge!);
          results.push({
            symbol: "DOGE",
            blockchain: "Dogecoin",
            address: queries.doge!,
            shortAddress: formatShortAddress(queries.doge!, 4, 4),
            balance: bal,
            unit: "DOGE",
            formattedBalance: `${bal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} DOGE`,
            syncDate,
          });
        } catch (err: unknown) {
          results.push({
            symbol: "DOGE",
            blockchain: "Dogecoin",
            address: queries.doge!,
            shortAddress: formatShortAddress(queries.doge!, 4, 4),
            balance: 0,
            unit: "DOGE",
            formattedBalance: "0.00 DOGE",
            error: (err as Error).message,
            syncDate,
          });
        }
      })()
    );
  }

  // XRP
  if (queries.xrp) {
    promises.push(
      (async () => {
        try {
          const bal = await fetchXrpBalance(queries.xrp!);
          results.push({
            symbol: "XRP",
            blockchain: "XRP Ledger",
            address: queries.xrp!,
            shortAddress: formatShortAddress(queries.xrp!, 4, 4),
            balance: bal,
            unit: "XRP",
            formattedBalance: `${bal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} XRP`,
            syncDate,
          });
        } catch (err: unknown) {
          results.push({
            symbol: "XRP",
            blockchain: "XRP Ledger",
            address: queries.xrp!,
            shortAddress: formatShortAddress(queries.xrp!, 4, 4),
            balance: 0,
            unit: "XRP",
            formattedBalance: "0.00 XRP",
            error: (err as Error).message,
            syncDate,
          });
        }
      })()
    );
  }

  await Promise.all(promises);

  // Ordre de priorité constant : ETH, BTC, DOGE, XRP
  const order = ["ETH", "BTC", "DOGE", "XRP"];
  results.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));

  return results;
}
