use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::state::Escrow;

#[derive(Accounts)]
#[instruction(seed: u64, receive: u64)]
pub struct Make<'info> {
    /// CHECK: This is the maker (original escrow creator) who will receive funds

    #[account(mut)]    /// CHECK: This is the maker (original escrow creator) who will receive funds
    pub maker: Signer<'info>,

    #[account(
    mint::token_program = token_program
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program
        )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
        )]
    pub maker_ata_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program
        )]
    pub maker_ata_b: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        init,
        payer=maker,
        seeds = [b"escrow", maker.key().as_ref(), seed.to_le_bytes().as_ref()],
        space = 8 + Escrow::INIT_SPACE,
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init,
        payer=maker,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,


    pub system_program: Program<'info, System>,
}

impl<'info> Make<'info> {
    pub fn init_escrow(&mut self, seed: u64, receive: u64, bumps: &MakeBumps) -> Result<()> {
        msg!("Greetings from: {:?}", self.maker.key());
        msg!("Seed: {:?}", seed);
        msg!("Mint A: {:?}", self.mint_a.key());
        msg!("Mint B: {:?}", self.mint_b.key());
        msg!("Maker ATA A: {:?}", self.maker_ata_a.key());
        msg!("Maker ATA B: {:?}", self.maker_ata_b.key());
        msg!("Escrow: {:?}", self.escrow.key());
        msg!("Vault: {:?}", self.vault.key());

        self.escrow.set_inner(Escrow {
            seed,
            maker: self.maker.key(),
            mint_a: self.mint_a.key(),
            mint_b: self.mint_b.key(),
            receive:receive,
            bump: bumps.escrow,
        });

        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        msg!("Depositing {} tokens into the vault", amount);

        let cpi_accounts = TransferChecked {
            from: self.maker_ata_a.to_account_info(),
            mint: self.mint_a.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.maker.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_ctx, amount, self.mint_a.decimals)?;

        Ok(())
    }
}
