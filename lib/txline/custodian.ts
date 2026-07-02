// lib/txline/custodian.ts
//
// Server-side custodial onboarding: the backend holds one master Solana
// keypair, subscribes it on-chain to the World Cup free tier once, and
// caches the resulting JWT + X-Api-Token so the frontend never touches
// a wallet. See config.ts header for what's been verified against the
// real docs vs. inferred.

import * as anchor from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import axios from 'axios';

import { activeConfig, apiBaseUrl, WORLD_CUP_FREE_SERVICE_LEVEL } from './config';
import txoracleIdl from './txoracle.idl.json';

export interface TxLineCredentials {
  jwt: string;
  apiToken: string;
}

export class TxLineCustodianEngine {
  private connection: Connection;
  private masterKeypair: Keypair;
  private provider: anchor.AnchorProvider;
  private program: anchor.Program;

  private cachedJwt: string | null = null;
  private cachedApiToken: string | null = null;
  private issuedAt: number | null = null;
  private subscribeTxSig: string | null = null;
  private lastLeagues: number[] = [];

  constructor() {
    const privateKeyStr = process.env.SOLANA_MASTER_PRIVATE_KEY;
    if (!privateKeyStr) {
      throw new Error(
        'SOLANA_MASTER_PRIVATE_KEY is missing. Must be a base58-encoded secret ' +
        'key for a funded devnet keypair, kept ONLY in server env vars.'
      );
    }

    this.connection = new Connection(activeConfig.rpcUrl, 'confirmed');
    this.masterKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr));

    this.provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.masterKeypair),
      { commitment: 'confirmed' }
    );

    // Anchor 0.30+ IDL embeds the program address in the IDL itself.
    this.program = new anchor.Program(txoracleIdl as anchor.Idl, this.provider);

    if (!this.program.programId.equals(activeConfig.programId)) {
      throw new Error(
        `Loaded IDL program (${this.program.programId.toBase58()}) does not ` +
        `match configured network program (${activeConfig.programId.toBase58()}).`
      );
    }
  }

  public async bootCustodianPipeline(
    serviceLevelId: number = WORLD_CUP_FREE_SERVICE_LEVEL,
    durationWeeks: number = 4,
    selectedLeagues: number[] = []
  ): Promise<TxLineCredentials> {
    console.log('[txline] [1/3] requesting guest JWT...');
    this.cachedJwt = await this.getGuestJwt();

    console.log('[txline] [2/3] submitting on-chain subscribe()...');
    this.subscribeTxSig = await this.sendSubscribeTransaction(serviceLevelId, durationWeeks);
    this.lastLeagues = selectedLeagues;

    console.log('[txline] [3/3] activating API token...');
    this.cachedApiToken = await this.activateApiToken(this.subscribeTxSig, selectedLeagues);
    this.issuedAt = Date.now();

    console.log('[txline] custodian pipeline ready.');
    return { jwt: this.cachedJwt, apiToken: this.cachedApiToken };
  }

  /**
   * Cheap refresh path: gets a fresh guest JWT and re-activates against the
   * SAME confirmed subscribe tx. Deliberately does NOT call subscribe()
   * again — the on-chain subscription persists for its `weeks` duration,
   * and re-subscribing while active hits the IDL's ActiveSubscription
   * error. Falls back to a full bootCustodianPipeline() if no prior
   * subscribe tx exists yet.
   */
  public async refreshCredentials(): Promise<TxLineCredentials> {
    if (!this.subscribeTxSig) {
      return this.bootCustodianPipeline();
    }
    console.log('[txline] refreshing JWT + api token (subscription already active)...');
    this.cachedJwt = await this.getGuestJwt();
    this.cachedApiToken = await this.activateApiToken(this.subscribeTxSig, this.lastLeagues);
    this.issuedAt = Date.now();
    return { jwt: this.cachedJwt, apiToken: this.cachedApiToken };
  }

  /** Age of the current credentials in ms — used by the singleton to decide when to refresh. */
  public credentialAgeMs(): number {
    if (!this.issuedAt) return Infinity;
    return Date.now() - this.issuedAt;
  }

  private async getGuestJwt(): Promise<string> {
    const response = await axios.post(`${activeConfig.apiOrigin}/auth/guest/start`);
    return response.data.token;
  }

  private async sendSubscribeTransaction(
    serviceLevelId: number,
    durationWeeks: number
  ): Promise<string> {
    const { txlTokenMint } = activeConfig;
    const programId = this.program.programId;

    const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('token_treasury_v2')],
      programId
    );

    const tokenTreasuryVault = getAssociatedTokenAddressSync(
      txlTokenMint,
      tokenTreasuryPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pricing_matrix')],
      programId
    );

    const userTokenAccount = getAssociatedTokenAddressSync(
      txlTokenMint,
      this.masterKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    return this.program.methods
      .subscribe(serviceLevelId, durationWeeks)
      .accounts({
        user: this.masterKeypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async activateApiToken(txSig: string, selectedLeagues: number[]): Promise<string> {
    if (!this.cachedJwt) throw new Error('JWT not initialized.');

    const messageString = `${txSig}:${selectedLeagues.join(',')}:${this.cachedJwt}`;
    const message = new TextEncoder().encode(messageString);
    const signatureBytes = nacl.sign.detached(message, this.masterKeypair.secretKey);
    const walletSignature = Buffer.from(signatureBytes).toString('base64');

    const response = await axios.post(
      `${apiBaseUrl}/token/activate`,
      { txSig, walletSignature, leagues: selectedLeagues },
      { headers: { Authorization: `Bearer ${this.cachedJwt}` } }
    );

    return response.data.token || response.data;
  }

  public getSessionHeaders(): Record<string, string> {
    if (!this.cachedJwt || !this.cachedApiToken) {
      throw new Error('Tokens are uninitialized. Call bootCustodianPipeline() first.');
    }
    return {
      Authorization: `Bearer ${this.cachedJwt}`,
      'X-Api-Token': this.cachedApiToken,
    };
  }
}
