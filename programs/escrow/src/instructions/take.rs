use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::state::Escrow;

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK: This is the maker (original escrow creator) who will receive funds
    #[account(mut)]
    pub maker: SystemAccount<'info>,

    #[account(
    mint::token_program = token_program
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mint::token_program = token_program
        )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = taker,
        associated_token::mint = mint_b,
        associated_token::authority = maker,
        associated_token::token_program = token_program
        )]
    pub maker_ata_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = taker,
        associated_token::token_program = token_program
        )]
    pub taker_ata_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = taker,
        associated_token::token_program = token_program
        )]
    pub taker_ata_b: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    #[account(
        mut,
        has_one = mint_a,
        has_one = mint_b,
        has_one = maker,
        seeds = [b"escrow", escrow.maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
        bump=escrow.bump,
        close = maker,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Take<'info> {
    pub fn deposit(&mut self) -> Result<()> {

        print!("Depositing into vault");

        let cpi_accounts: TransferChecked<'_> = TransferChecked {
            from: self.taker_ata_b.to_account_info(),     // 🧍 taker sends token B
            mint: self.mint_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),           // 🎯 into maker b 
            authority: self.taker.to_account_info(),      // 🔐 signed by taker
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_ctx, self.escrow.receive, self.mint_b.decimals)?;

        print!("Deposted into vault");
        Ok(())
    }

    pub fn withdraw_and_close_vault(&mut self) -> Result<()> {

        print!("Withdrawing from vault and closing it");

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"escrow",
            self.maker.key.as_ref(),
            &self.escrow.seed.to_le_bytes()[..],
            &[self.escrow.bump],
        ]];

        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint_a.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, self.vault.amount, self.mint_a.decimals)?;

        let accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            accounts,
            &signer_seeds,
        );

        close_account(ctx)?;

        print!("Withdrew from vault and closed it");

        Ok(())
    }
}
