use anchor_lang::prelude::*;

mod instructions;
use instructions::*;

mod state;
declare_id!("An2QgFuVoP773KqLETGJWNQJCRD5ha3TYQxUy3Zy8sBf");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, receive: u64, deposit: u64) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);

        ctx.accounts.init_escrow(seed, receive, &ctx.bumps)?;
        
        ctx.accounts.deposit(deposit)?;

        Ok(())
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);

        ctx.accounts.deposit()?;
        ctx.accounts.withdraw_and_close_vault()?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
