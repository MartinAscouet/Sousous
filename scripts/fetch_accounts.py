#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Wrapper Woob pour récupérer les comptes bancaires.
Supporte :
1. Les identifiants dynamiques passés via stdin (JSON) sans écriture sur disque.
2. La configuration locale existante (fallback ~/.config/woob/backends).

Sortie standardisée au format JSON sur stdout.
"""

import sys
import json
import traceback

def map_account_type(type_int_or_str, label=""):
    """
    Normalise le type de compte Woob vers l'enum TypeScript de l'application :
    CHECKING, SAVINGS, PEA, CTO, OTHER
    """
    type_str = str(type_int_or_str).upper()
    label_lower = str(label).lower()

    if "PEA" in label_lower or "PEA" in type_str:
        return "PEA"
    if "TITRE" in label_lower or "MARKET" in type_str or "CTO" in label_lower:
        return "CTO"
    if any(k in label_lower for k in ["livret", "épargne", "epargne", "ldd", "lep", "pel", "cel", "csl", "assurance", "vie", "previ"]) or "SAVINGS" in type_str or "DEPOSIT" in type_str:
        return "SAVINGS"
    if "CHECKING" in type_str or "CARD" in type_str or any(k in label_lower for k in ["courant", "chèque", "cheque"]):
        return "CHECKING"
    
    return "CHECKING"

def fetch_accounts():
    try:
        # Import local pour attraper les erreurs de dépendance Woob proprement
        try:
            from woob.core import Woob
            from woob.capabilities.bank import CapBank
            from woob.exceptions import (
                BrowserIncorrectPassword,
                BrowserQuestion,
                ActionNeeded,
                BrowserUnavailable,
                AuthMethodNotImplemented
            )
        except ImportError:
            return {
                "success": False,
                "error": "Le package Python 'woob' n'est pas installé dans l'environnement virtuel.",
                "errorCode": "EXECUTION_ERROR",
                "details": "Exécutez 'pip install woob' pour installer la bibliothèque."
            }

        woob = Woob()
        backends = []

        # 1. Vérification si des identifiants sont fournis via stdin (chiffrement RAM -> stdin)
        stdin_data = None
        if not sys.stdin.isatty():
            try:
                raw_input = sys.stdin.read().strip()
                if raw_input:
                    stdin_data = json.loads(raw_input)
            except Exception:
                stdin_data = None

        if stdin_data:
            # Format attendu : {"backends": [{"module": "cmb", "login": "...", "password": "...", "label": "CMB"}]}
            # ou {"module": "cmb", "login": "...", "password": "..."}
            target_backends = stdin_data.get("backends") if isinstance(stdin_data, dict) and "backends" in stdin_data else ([stdin_data] if isinstance(stdin_data, dict) and "module" in stdin_data else [])
            
            for b_cfg in target_backends:
                mod_name = b_cfg.get("module") or b_cfg.get("bankModule")
                if not mod_name:
                    continue
                
                params = {}
                for k, v in b_cfg.items():
                    if k not in ["module", "bankModule", "label"]:
                        params[k] = v
                
                try:
                    # Instanciation dynamique du backend en mémoire RAM (sans toucher au disque)
                    built_b = woob.build_backend(mod_name, params)
                    backends.append(built_b)
                except Exception as b_err:
                    return {
                        "success": False,
                        "error": f"Impossible d'initialiser le module bancaire '{mod_name}' : {str(b_err)}",
                        "errorCode": "AUTH_REQUIRED",
                        "details": traceback.format_exc()
                    }
        else:
            # Fallback : Chargement des backends configurés localement sur la machine
            woob.load_backends(caps=CapBank)
            backends = list(woob.iter_backends())

        if not backends:
            return {
                "success": False,
                "error": "Aucun compte bancaire ou identifiant configuré.",
                "errorCode": "AUTH_REQUIRED",
                "details": "Renseignez vos identifiants via l'interface de l'application ou la commande 'woob config cmb'."
            }

        accounts_list = []

        for backend in backends:
            try:
                for account in backend.iter_accounts():
                    balance_val = float(account.balance) if account.balance is not None else 0.0
                    currency_val = str(account.currency) if getattr(account, 'currency', None) else "EUR"
                    
                    accounts_list.append({
                        "id": str(account.id),
                        "label": str(account.label or "Compte sans nom"),
                        "balance": round(balance_val, 2),
                        "currency": currency_val,
                        "type": map_account_type(getattr(account, 'type', ''), getattr(account, 'label', '')),
                        "rawType": str(getattr(account, 'type', '')),
                        "iban": str(getattr(account, 'iban', '')) if getattr(account, 'iban', None) else None,
                        "bankName": str(getattr(backend, 'name', 'Banque'))
                    })
            except BrowserIncorrectPassword as e:
                return {
                    "success": False,
                    "error": f"Identifiants bancaires incorrects pour le module {getattr(backend, 'name', '')}.",
                    "errorCode": "AUTH_REQUIRED",
                    "details": str(e)
                }
            except (BrowserQuestion, ActionNeeded) as e:
                return {
                    "success": False,
                    "error": f"Validation 2FA ou confirmation sur l'application mobile requise pour {getattr(backend, 'name', '')}.",
                    "errorCode": "2FA_REQUIRED",
                    "details": str(e)
                }
            except BrowserUnavailable as e:
                return {
                    "success": False,
                    "error": f"Le serveur de la banque ({getattr(backend, 'name', '')}) est temporairement inaccessible.",
                    "errorCode": "TIMEOUT",
                    "details": str(e)
                }

        total_balance = sum(acc["balance"] for acc in accounts_list)

        return {
            "success": True,
            "accounts": accounts_list,
            "totalBalance": round(total_balance, 2),
            "currency": "EUR"
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Erreur inattendue lors de l'exécution de Woob: {str(e)}",
            "errorCode": "UNKNOWN",
            "details": traceback.format_exc()
        }

if __name__ == "__main__":
    result = fetch_accounts()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get("success") else 1)
