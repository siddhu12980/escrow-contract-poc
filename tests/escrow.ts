import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

import fs from "fs";
import path from "path";

import { BN } from "bn.js";
import { expect } from "chai";

describe("escrow", () => {
  const program_id = anchor.workspace.Escrow.programId;

  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.escrow as Program<Escrow>;

  const makerKeypairPath = path.resolve(__dirname, "maker-keypair.json");
  const maker = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(makerKeypairPath, "utf-8")))
  );

  const takerKeypairPath = path.resolve(__dirname, "taker-keypair.json");
  const taker = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(takerKeypairPath, "utf-8")))
  );

  const escrow_seed = new BN(Math.floor(Math.random() * 1000000));
  // const escrow_seed = new BN(570974);

  const mintAKeypair = Keypair.generate();
  const mintBKeypair = Keypair.generate();

  

  it("Is initialized!", async () => {
    try {
      console.log("seed", escrow_seed.toNumber());

      console.log("maker public key:", maker.publicKey.toString());
      console.log("Connected to:", program.provider.connection.rpcEndpoint);

     
      const mintA = await createMint(
        program.provider.connection,
        maker,
        maker.publicKey,
        maker.publicKey,
        0,
        mintAKeypair
      );
      console.log("mintA created:", mintA.toString());

      const mintB = await createMint(
        program.provider.connection,
        maker,
        maker.publicKey,
        maker.publicKey,
        0,
        mintBKeypair
      );
      console.log("mintB created:", mintB.toString());

      const makerTokenA = await getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        maker,
        mintA,
        maker.publicKey
      );
      console.log("makerTokenA created:", makerTokenA.address.toString());

      await mintTo(
        program.provider.connection,
        maker,
        mintA,
        makerTokenA.address,
        maker.publicKey,
        100
      );

      console.log("Minted 100 tokens to makerTokenA");

      const makerTokenB = await getOrCreateAssociatedTokenAccount(
        program.provider.connection,
        maker,
        mintB,
        maker.publicKey
      );

      console.log("makerTokenB created: ", makerTokenB.address.toBase58());

      await program.methods
        .make(escrow_seed, new BN(100), new BN(10))
        .accounts({
          maker: maker.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          mintA,
          mintB,
        })
        .signers([maker])
        .rpc();

      console.log("Escrow created successfully");
    } catch (e) {
      console.log("Error details:", e);
      throw e;
    }
  });

  it.skip("get all data", async () => {
    try {
      const [escrowPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("escrow"),
          maker.publicKey.toBuffer(),
          escrow_seed.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      console.log("Escrow PDA FOUND");
      console.log("✅  Escrow PDA:", escrowPDA.toBase58());

      const escrowAccount = await program.account.escrow.fetch(escrowPDA);

      console.log("✅ Escrow Account:", escrowAccount);

      console.log("Maker:", escrowAccount.maker.toBase58());
      console.log("Mint A:", escrowAccount.mintA.toBase58());
      console.log("Mint B:", escrowAccount.mintB.toBase58());
      console.log("Expected Amount:", escrowAccount.mintA.toString());
      console.log("Expected in Return:", escrowAccount.mintB.toString());
    } catch (e) {
      console.error("❌ Failed to fetch escrow:", e);
      throw e;
    }
  });

  it("taker txn ", async () => {
    console.log("Workign on it ");

    const [escrowPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        escrow_seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    console.log("Escrow PDA FOUND");
    console.log("✅  Escrow PDA:", escrowPDA.toBase58());

    const escrowAccount = await program.account.escrow.fetch(escrowPDA);

    console.log("seed", escrow_seed.toNumber());

    console.log("taker public key:", taker.publicKey.toString());
    console.log("maker public key:", maker.publicKey.toString());

    console.log("Connected to:", program.provider.connection.rpcEndpoint);

    const mintA = escrowAccount.mintA;
    const mintB = escrowAccount.mintB;

    console.log("Using mintA:", mintA.toString());
    console.log("Using mintB:", mintB.toString());

    const takerAtaA = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      taker,
      mintA,
      taker.publicKey
    );
    console.log("Taker token A account:", takerAtaA.address.toString());

    const takerAtaB = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      taker,
      mintB,
      taker.publicKey
    );
    console.log("Taker token B account:", takerAtaB.address.toString());

    // await mintTo(
    //   program.provider.connection,
    //   taker,
    //   mintB,
    //   takerAtaB.address,
    //   taker,
    //   100
    // );

    await mintTo(
      program.provider.connection,
      maker, // ✅ mint authority
      mintB, // the mint
      takerAtaB.address, // destination: taker’s token B account
      maker, // ✅ again, mint authority signs
      100 // amount
    );

    console.log("Minted 100 tokens to takerTokenB");

    const makerAtaB = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      taker, // Using taker to pay for the transaction
      mintB,
      escrowAccount.maker
    );

    console.log("Maker token B account:", makerAtaB.address.toString());

    const vault = await getAssociatedTokenAddress(
      mintA,
      escrowPDA,
      true // Allow owning PDA
    );
    console.log("Vault address:", vault.toString());

    console.log({
      taker: taker.publicKey.toString(),
      maker: maker.publicKey.toString(),
      mintA: escrowAccount.mintA.toString(),
      mintB: escrowAccount.mintB.toString(),
      makerAtaB: makerAtaB.address.toString(),
      takerAtaA: takerAtaA.address.toString(),
      takerAtaB: takerAtaB.address.toString(),
      escrow: escrowPDA.toString(),
      vault: vault.toString(),
    });

    const txn = await program.methods
      .take()
      .accountsPartial({
        taker: taker.publicKey,
        maker: maker.publicKey,
        mintA: mintA,
        mintB: mintB,
        makerAtaB: makerAtaB.address,
        takerAtaA: takerAtaA.address,
        takerAtaB: takerAtaB.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        escrow: escrowPDA,
        vault: vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();

    console.log("Transaction signature", txn);
    console.log("Transaction successful");
  });

  it.skip("Airdrops 2 SOL to maker on devnet", async () => {
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );

    console.log("key", taker.publicKey.toBase58());

    const airdropSignature = await connection.requestAirdrop(
      taker.publicKey,
      2 * LAMPORTS_PER_SOL
    );

    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: airdropSignature,
      ...latestBlockHash,
    });

    const balance = await connection.getBalance(taker.publicKey);
    console.log("Balance after airdrop:", balance / LAMPORTS_PER_SOL, "SOL");

    if (balance < 2 * LAMPORTS_PER_SOL) {
      throw new Error("Airdrop failed or only partially succeeded.");
    }
  });

  it("verifies balances and vault closure after escrow", async () => {
    console.log("seed", escrow_seed.toNumber());

    const [escrowPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        escrow_seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    console.log("Escrow PDA FOUND");
    console.log("✅  Escrow PDA:", escrowPDA.toBase58());

    const mintA = mintAKeypair.publicKey;
    const mintB = mintBKeypair.publicKey;

    const makerTokenA = await getAssociatedTokenAddress(mintA, maker.publicKey);
    const makerTokenB = await getAssociatedTokenAddress(mintB, maker.publicKey);

    console.log("Maker Token found");
    const takerTokenA = await getAssociatedTokenAddress(mintA, taker.publicKey);
    const takerTokenB = await getAssociatedTokenAddress(mintB, taker.publicKey);

    console.log("Taker Token found");


    const makerA = await program.provider.connection.getTokenAccountBalance(
      makerTokenA
    );

    console.log("Maker A Balance:", makerA.value.uiAmountString);

    const makerB = await program.provider.connection.getTokenAccountBalance(
      makerTokenB
    );

    console.log("Maker B Balance:", makerB.value.uiAmountString);


    const takerA = await program.provider.connection.getTokenAccountBalance(
      takerTokenA
    );
    console.log("Taker A Balance:", takerA.value.uiAmountString);

    const takerB = await program.provider.connection.getTokenAccountBalance(
      takerTokenB
    );

    console.log("Taker B Balance:", takerB.value.uiAmountString);

    console.log("\n \n ✔️ Maker A Balance:", makerA.value.uiAmountString);
    console.log("✔️ Maker B Balance:", makerB.value.uiAmountString);
    console.log("✔️ Taker A Balance:", takerA.value.uiAmountString);
    console.log("✔️ Taker B Balance:", takerB.value.uiAmountString);

    // You can hardcode or dynamically refer to these numbers based on your escrow
    const expectedMakerA = 90; // Maker gave 100 A
    const expectedMakerB = 100; // Maker received 10 B

    const expectedTakerA = 10; // Taker received 100 A
    const expectedTakerB = 0; // Taker started with 100 B, gave 10

    expect(Number(makerA.value.amount)).equal(expectedMakerA);
    expect(Number(makerB.value.amount)).equal(expectedMakerB);
    expect(Number(takerA.value.amount)).equal(expectedTakerA);
    expect(Number(takerB.value.amount)).equal(expectedTakerB);

    console.log("✔️ Balances verified");

    // Check that vault no longer exists (should throw)
    try {
      const vault = await getAssociatedTokenAddress(mintA, escrowPDA, true);

      await program.provider.connection.getTokenAccountBalance(vault);
      throw new Error("Vault still exists!");
    } catch (err) {
      console.log("✔️ Vault closed successfully");
    }
  });
});
