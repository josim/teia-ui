// Bundled FAQ/help content chunks for the AI assistant's retrieval tool.
//
// Sourced from src/pages/faq/index.jsx (answers converted from HTML to
// plain markdown) and src/lang/en/{about,DAO_claim,codeofconduct,corevalues}.md.
// Long sections are split by heading to keep each chunk under ~200 words.

export interface FaqChunk {
  id: string
  topic: string
  text: string
}

export const FAQ_CHUNKS: FaqChunk[] = [
  {
    id: 'wallet-overview',
    topic: 'How do I Make a Wallet?',
    text: `First, you will need a Tezos wallet and Tezos funds.

What is Tezos?
Tezos (XTZ) is a liquid proof-of-stake cryptocurrency (LPoS). You can read more about it on the [Wikipedia article about Tezos](https://en.wikipedia.org/wiki/Tezos).

Recommended Wallet Apps
- [Temple wallet](https://templewallet.com/), a browser extension similar to Metamask that can also connect to Ledger devices.
- [Kukai wallet](https://wallet.kukai.app/), a browser wallet that can connect using Direct Auth with Twitter credentials. Kukai also works on smartphones.

Where to Buy Tezos
Minting on Teia only costs ~0.05 tezos. You can buy some tezos on an exchange site like Binance or Kraken. However, the exchange service might be limited depending on your country and location.`,
  },
  {
    id: 'wallet-fountain',
    topic: 'How do I Make a Wallet? — The Teia Fountain',
    text: `Applying as an Artist
Are you an artist who needs tez but can't get it? You can request a volunteer from the community to sponsor you in the #fountain channel on [Discord](https://discord.gg/wGeXs4Z7wT).

Please fill out this google form: [https://docs.google.com/forms/d/e/1FAIpQLScUYFFw2eUXX64RHOPwUD1LZ8hD4qaiGRpOg-Su1El-W2OXGQ/viewform](https://docs.google.com/forms/d/e/1FAIpQLScUYFFw2eUXX64RHOPwUD1LZ8hD4qaiGRpOg-Su1El-W2OXGQ/viewform). After filling out the form, send us a message in the #fountain channel on Discord saying that you filled out the form.

Volunteering as a Sponsor
If you make some sales and would like to support other new artists, you can send XTZ donations to the [fountain multisig address](https://github.com/teia-community/teia-docs/wiki/Teia-Multisig-wallets) KT1EsvmkijLKPQmcJMbjDeKRXdwky1LWvwpG.`,
  },
  {
    id: 'wallet-errors',
    topic: 'How do I Make a Wallet? — Common Wallet Errors',
    text: `"account doesn't exist" error from tzkt.io
If your account on tzkt.io shows this, don't worry. It just means you don't have any transactions yet in your wallet. Once you receive some tezos it should go away.

Prevalidation error in the Temple wallet
This means you should refresh the page. Wait a couple of seconds for the transaction to go through and you will get the "applied" status.`,
  },
  {
    id: 'mint-rules',
    topic: 'How do I Mint? — Rules and Considerations',
    text: `mint (verb): to create an OBJKT (NFT).

If you mint NFTs on Teia, we expect you to respect the [Core Values](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions) and especially note the detail on [copyminting](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#about-copyminting).

Copyminting is the act of taking another's work and minting it as your own. It also includes minting the same work twice, either on the same or separate platforms/blockchains. Your account will get restricted if you do this.

Please note that minting the same media file twice, even accidentally, may lead to an account restriction! If you made a mistake and want to re-mint your OBJKT, make sure to burn the old one first! ([How to burn](https://github.com/teia-community/teia-docs/wiki/How-to-burn-%F0%9F%94%A5))

If your account gets restricted, check [how to unrestrict](https://objkt.com/asset/KT1XcFQv9EB2hoT484Cv58S2MvyMGX4C9TJq/1) it.`,
  },
  {
    id: 'mint-steps',
    topic: 'How do I Mint? — Step-by-Step Guide',
    text: `Minting creates an NFT: you set the quantity and information such as title and description. After minting, you choose how many editions to make available and set a price (a Swap operation).

It helps to prepare a text file with the information you need before minting, in case the operation is interrupted.

1. You should already have a wallet (we recommend [Temple](https://templewallet.com/) or [Kukai](https://wallet.kukai.app/)) with enough funds to mint. Click "Sync" and approve the pop-up.
2. Click the "Mint" link in the hamburger drop-down menu.
3. Fill out the OBJKT information. Because it's stored on the Tezos blockchain, the edition size (quantity) is final — you can't add more, though you can reduce it by burning. Title, description, tags, and royalties are also final. You price the OBJKT (a Swap operation) after minting, and can upload display images/gifs depending on media type. You can also select a license (default: None / all rights reserved) and a language.`,
  },
  {
    id: 'mint-text',
    topic: 'How do I Mint? — Text Mints on Teia',
    text: `The Teia NFT marketplace supports text mints of mimetype text/plain, for stories, poems, ASCII, and similar text-based art. The token's content is stored in IPFS.

How to Mint Text:
1. Check the "This is a text mint" box on the minting page.
2. The text mint input replaces the description box.
3. Check "Monospace Font Required" if desired — the text area renders in the monospace Iosevka font or the non-monospace Source Sans Pro font.
4. As you type, a rendered preview appears below the text area, shown again on the "Submit" preview page.

Note: the "monospace" tag is added automatically, and cover/thumbnail images are generated from the text input and chosen font. The description is replaced by the text mint input. Example: [OBJKT 850488](https://teia.art/objkt/850488).

Source Sans Pro is used because it's Objkt.com's default non-mono font, ensuring correct display there and on Teia.art, since Objkt.com currently has limited monospace support for text tokens.`,
  },
  {
    id: 'edit-profile',
    topic: 'How do I Edit My Profile?',
    text: `Settings > Config
Profile information is useful in a number of ways. Most importantly, it can identify you to your potential collectors. Your profile details are saved with the Subjkt contract. The Profile page is where you update these, and it also links to the tzprofiles site so you can add that information.

To edit your profile, make sure you've synced your wallet with Teia. Click the menu icon or go to [https://www.teia.art/subjkt](https://www.teia.art/subjkt), then click on the Profile option.

Add a username, description, and choose an image for your profile pic. The profile pic may take a few moments to show up. Because it shows with a circular crop, you may have to adjust your initial picture and add it again.

IMPORTANT: when configuring your username, please don't use any special characters or spaces. It's also case-sensitive, so we recommend ALL LOWERCASE.

When you click Save Profile, your wallet will open so you can complete a transaction which saves the profile information.`,
  },
  {
    id: 'swap-overview',
    topic: 'How do I Add/Change the Price of My OBJKT? — What is Swapping',
    text: `swap (noun): an act, instance, or process of exchanging one thing for another.
swap (verb): to set a price for your OBJKT.

If you have just minted some OBJKTs or you have unsold OBJKTs, it's time to Swap them — that means pricing some or all, for collectors to buy.

Note: you can't swap OBJKTs that are already swapped, already collected, or if you don't have enough tez to pay the fees. You won't see Swap, Burn, Transfer options or be able to cancel swaps if you haven't synced the account that owns them.

You don't need to swap all of the OBJKTs you own — many artists keep one or two as 'artist proofs' or for gifting.

Pricing depends on edition size, how well known you are, and how you market your work, as well as what you want for the piece. Pricing very low (e.g. 0.01 tez) or free risks bots or flippers buying many editions, which can reflect badly on the work and artist when collectors view the OBJKT's sale history.`,
  },
  {
    id: 'swap-steps-tracking',
    topic: 'How do I Add/Change the Price of My OBJKT? — Step-by-Step Guide',
    text: `1. Click on your OBJKT's link to see the details. If synced to your wallet, you'll see the "Swap" option next to History. (If not, sync your wallet again.)
2. Click on Swap.
3. Input how many editions you want to set for sale (e.g. if you have 10 and want to keep 1, input 9).
4. Input the price per edition in Tezos.
5. Click the "swap" button and approve the transaction in your wallet app.
6. The interface will update, or you can check your wallet's activity. Once approved, your OBJKTs are for sale.

How Can I Track What I've Sold?
Use [hictory](https://www.hictory.xyz/#) or [hicdex](https://hicdex.com/sold): enter your wallet address to see your last sales in chronological order.

How Can I Get Notifications for When I Sell Something?
Use the [Cryptonoises bot](https://cryptonoises.com/), developed by Andrii Bakulin. It works with Telegram and Discord to notify you every time something sells.`,
  },
  {
    id: 'burn-overview',
    topic: 'How do I Burn My OBJKT? — Overview',
    text: `burn (verb): to "delete" your OBJKT.

Transactions on the blockchain are irreversible, so you can't truly "delete" them. The "burn" button sends the OBJKT to the [burn address](https://tzkt.io/tz1burnburnburnburnburnburnburjAYjjX/operations/), tz1burnburnburnburnburnburnburjAYjjX, or you can send it yourself using your wallet app. Nobody owns a key to this address, so objkts sent there are never retrievable.

If you're burning an OBJKT because you made a mistake and want to remint it, make sure there are no other owners — you can only burn OBJKTs you own, so you'll need other collectors to burn their copies first.

Note: if you burn all editions of an OBJKT, it disappears from your profile — unless someone else still owns one, in which case it remains.`,
  },
  {
    id: 'burn-steps',
    topic: 'How do I Burn My OBJKT? — Step-by-Step Guide',
    text: `1. Make sure your wallet app is synced with Teia.
2. Cancel the swap of the OBJKT so it's available in your wallet for burning. The interface shows how many you have available to burn — think carefully, as this can't be undone.
3. Press the burn button and confirm in your wallet app. Once complete, the OBJKT is shown as transferred to the burn address, and the History tab shows a Burn transaction.
4. You can also send the OBJKT directly to the burn address from your Tezos wallet: tz1burnburnburnburnburnburnburjAYjjX.`,
  },
  {
    id: 'resell-overview',
    topic: 'How do I Resell an OBJKT?',
    text: `If you've collected another artist's OBJKT, then you own the right to resell it — also called placing it on the secondary market. It's much the same as swapping one of your own creations, although a royalty will be paid to the artist.

Step-by-Step Guide
1. Make sure your wallet is synced.
2. Load your account page on Teia.
3. Click on "collection" and click on the OBJKT you want to resell.
4. Click on the "listings" tab to see all owners and sellers.
5. Click on "swap" and set a price for your OBJKT. Remember — royalties will go to the artist, so factor that into your pricing.
6. Click the "swap" button and confirm the transaction in your wallet app.

Important: once swapped up for sale, the OBJKT is held in the Teia escrow wallet while "on the market," so it will disappear from your collections — it's still up for sale.`,
  },
  {
    id: 'resell-tracking',
    topic: 'How do I Resell an OBJKT? — Tracking Sales & Notifications',
    text: `How Can I Track What I've Sold?
Use [hicdex.com](https://hicdex.com) to track transaction history.

How Can I Get Notifications When I Sell Something?
Use the [Cryptonoises Telegram bot](https://cryptonoises.com/) to get a notification every time something sells. Thanks to Andrii Bakulin for this tool.`,
  },
  {
    id: 'copyright-features',
    topic: 'How Do I Get Started With Selling Copy and Usage Rights With TEIA?',
    text: `TEIA empowers artists to attach copy and usage rights clauses to each minted OBJKT (NFT), determined by the artist at minting time. Read each option carefully before using this feature.

The purpose is to let artists sell usage rights (for broadcasting, reproduction, merchandise, soundtracks, game assets, etc.) transparently and fairly, using the blockchain for clear, traceable documentation. TEIA DAO is a neutral platform that facilitates these agreements but doesn't enforce their terms; support varies across platforms since not all display or honor on-chain licensing data.

Disclaimer: TEIA is not a legal entity with authority to enforce laws or resolve disputes. Agreements attached to each mint form a direct contract between the artist (licensor) and collector (licensee), resolved through mutually agreed means if disputed. Both parties must be able to prove ownership of the relevant wallet(s) if required.

A member of the TEIA organization minted a step-by-step guide as an NFT: [TEIA Copyright Registration and Licensing Guide](https://teia.art/objkt/869379).

Artists are responsible for clearly defining terms; collectors must review and agree before purchasing; disputes should be resolved amicably, with legal counsel if necessary.`,
  },
  {
    id: 'faq-general',
    topic: 'General FAQ',
    text: `For general questions, check out the [General FAQ](https://github.com/teia-community/teia-docs/wiki/General-FAQs) page on the Teia community wiki.`,
  },
  {
    id: 'faq-troubleshooting',
    topic: 'Troubleshooting',
    text: `If you're having issues, visit the [Troubleshooting Guide](https://github.com/teia-community/teia-docs/wiki/Troubleshooting).`,
  },
  {
    id: 'faq-tools',
    topic: 'Useful Tools',
    text: `Explore tools created by the community: the [Tezos Toolkit](https://github.com/teia-community/teia-docs/wiki/Tools-made-by-the-community) and the wider [Tezos NFT marketplace ecosystem](https://tezos.com/ecosystem).`,
  },
  {
    id: 'faq-user-safety',
    topic: 'User Safety',
    text: `Stay safe by following these tips:
- Never share your private key.
- Use trusted wallets and platforms.
- Enable two-factor authentication (2FA) where available.`,
  },
  {
    id: 'about-teia',
    topic: 'What is Teia?',
    text: `Teia is a collaborative artwork made of artworks, a place for ideas and creative works. It is a non-profit, open-source online platform for trading digital assets as OBJKT NFTs. It is a collective, aligning under the values of sustainability, accessibility, and equity, owned and maintained by its community, built and improved by its participants. It is an infinite work in progress.

See also: [Core Values](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#core-values), [Code of Conduct](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#code-of-conduct), [Terms and Conditions](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#terms-and-conditions), and [Account Restrictions/Content Moderation](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#content-moderation).`,
  },
  {
    id: 'teia-links',
    topic: 'Teia Links & Resources',
    text: `Documentation: [wiki.teia.art](https://github.com/teia-community/teia-docs/wiki)
Blog: [blog.teia.art](https://blog.teia.art)
Announcements and Updates: [Twitter](https://twitter.com/TeiaCommunity)
Join the community: [Discord](https://discord.com/invite/7pZrPCcgnG)
Report Harassment or Scams via the [Report Form](https://docs.google.com/forms/d/e/1FAIpQLSeuBmNJjTiROSbHXXiQ5e-ia6fFywHKZ7Dj4-7sZtyltGY3yA/viewform)
Report Bugs via a [Github issue](https://github.com/teia-community/teia-ui/issues)
DAO Agora/Forum: Discourse discussions are being revised; check X for updates.
Code: [Teia Github](https://github.com/teia-community)
Community Curation: [@TeiaArt](https://twitter.com/TeiaCommunity)`,
  },
  {
    id: 'teia-imprint',
    topic: 'Teia Imprint',
    text: `Teia DAO LLC
Mail: info@teia.art
Principals office address: PO Box 852, Long Island Rd Majuro, Marshall Islands MH 96960
Registration Number: 10020-23 (registered via [MIDAO Directory Services](https://www.midao.org/))`,
  },
  {
    id: 'teia-tech-specs',
    topic: 'Teia Tech Specs & Smart Contracts',
    text: `The Teia Marketplace Interface and marketplace contract are [code forks](https://github.com/teia-community/teia-ui) based on the open-source Tezos NFT marketplace [hic et nunc](https://github.com/hicetnunc2000), further developed and maintained by the Teia community. The [marketplace fees](https://github.com/teia-community/teia-docs/wiki/Marketplace-Fees) are set to 2.5%.

Smart Contracts:
- FA2 Token Contract: [KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton](https://tzstats.com/KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton) by [hicetnunclab2000](https://github.com/hicetnunc2000/objkt-swap)
- Minting Contract: [KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9](https://tzkt.io/KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9/operations/) by [hicetnunclab2000](https://github.com/hicetnunc2000/objkt-swap)
- Marketplace Contract: [KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w](https://tzkt.io/KT1PHubm9HtyQEJ4BBpMTVomq6mhbfNZ9z5w/operations/) by [Teia community](https://github.com/teia-community/teia-smart-contracts/blob/main/python/contracts/teiaMarketplace_v1.py) — audited by [Inference AG](https://github.com/InferenceAG/ReportPublications/blob/master/Inference%20AG%20-%20Teia%20community%20-%20marketplace%20%26%20multisig%20-%20v1.0.pdf)
- Marketplace Contract Admin: [KT1PKBTVmdxfgkFvSeNUQacYiEFsPBw16B4P](https://tzkt.io/KT1PKBTVmdxfgkFvSeNUQacYiEFsPBw16B4P/operations/) — [multisig contract](https://multisign.onrender.com/) developed by the Teia Community

All code and contracts are [released under the MIT license](https://github.com/teia-community/teia-ui/blob/main/LICENSE).`,
  },
  {
    id: 'dao-claim-overview',
    topic: 'TEIA DAO Token Claim — Overview',
    text: `Here you can claim your TEIA DAO tokens. By owning TEIA tokens, you are part of the Teia DAO LLC and eligible to put forward and vote on DAO proposals for Teia. TEIA tokens are specifically designed and intended for governance purposes within the Teia DAO ecosystem.

If your Tezos wallet satisfies the conditions in the [token distribution fact sheet](https://blog.teia.art/blog/fact-sheet-token-drop), you were eligible to claim your TEIA tokens during the claiming period (August 22, 2023 to November 22, 2023). See the [token distribution spreadsheet](https://docs.google.com/spreadsheets/d/11jFANEUsvNSc9vQGD7sc46n_BOp8v0tGOLY1LG0KENk/edit?usp=sharing) for eligible addresses and amounts.

For questions about the token claim process, contact the team via Discord or mail at [info@teia.art](mailto:info@teia.art).`,
  },
  {
    id: 'dao-claim-howto',
    topic: 'How to Claim Your TEIA Tokens',
    text: `1. Sync your wallet with teia.art (top right corner). Check the URL before syncing — the only official Teia token claim page is at www.teia.art/dao.
2. Read the legal disclaimer, which outlines important information about the nature of TEIA tokens and your responsibilities as a token holder.
3. Confirm you have read the disclaimer by checking the box at the bottom of the page to unlock the claim button.
4. Click the "Claim TEIA DAO tokens" button and confirm the operation with your wallet. Your tokens should arrive after a few minutes.

If you own multiple eligible wallets, unsync and repeat the process for each wallet.`,
  },
  {
    id: 'dao-claim-disclaimer-governance',
    topic: 'TEIA Token Legal Disclaimer — Governance & Investment',
    text: `By claiming your TEIA DAO tokens, you agree to be bound by this disclaimer's terms. If you disagree with any part, don't participate in the token claim process.

1. Governance only: TEIA tokens distributed through the claim page are intended solely for governance purposes within the Teia DAO ecosystem. They do not represent any form of investment in the Teia DAO or any associated entity, and are not intended to be securities or investment assets. Teia does not intend to generate and distribute profits among its members, does not sell TEIA tokens, and does not aim to generate profit from them. Claiming TEIA tokens is free.

2. No investment advice: Information on the claim page, including articles and blog posts on blog.teia.art, is for informational purposes only and does not constitute investment advice or a recommendation. The Teia DAO team does not endorse buying or selling TEIA tokens as investment assets, makes no guarantees about their future value or performance, and disclaims responsibility for any losses from acquiring or trading them.`,
  },
  {
    id: 'dao-claim-disclaimer-membership',
    topic: 'TEIA Token Legal Disclaimer — Membership, Compliance & Liability',
    text: `3. DAO membership: By claiming and/or holding TEIA tokens, you become a member of the Teia DAO LLC. No personal information is required as long as you hold less than 10% of tokens in circulation. Every address is limited to 400k TEIA tokens (5% of total supply) initially. To stop being a member, send all your TEIA tokens to the [Teia Treasury address](https://tzkt.io/KT1J9FYz29RBQi1oGLw8uXyACrzXzV1dHuvb/operations/).

4. Regulatory compliance: Distribution and use of TEIA tokens may be subject to various laws and regulations in different jurisdictions. It is your sole responsibility to ensure compliance before participating; the Teia DAO team provides no legal, regulatory, or tax advice.

5. No liability: To the maximum extent permitted by law, the Teia DAO team, contributors, affiliates, and partners are not liable for damages arising from the TEIA tokens or the claim process.

6. Risk acknowledgement: By participating, you acknowledge and assume the risks of blockchain technology, cryptocurrencies, and market volatility, and agree to hold the Teia DAO team harmless against related claims.`,
  },
  {
    id: 'code-of-conduct-summary',
    topic: 'Teia Code of Conduct (Summary)',
    text: `Teia's Code of Conduct asks all community members to act lawfully, honestly, and ethically, and prohibits harassment, abuse, impersonation, spamming, and scamming; violations can lead to account restrictions or bans. It also sets fairplay rules for the marketplace (no automated collecting tools, no market manipulation, respect for artists' moral rights) and defines account restriction reasons like copyminting, double minting, and infringed copyright. Reports and disputes are handled via Discord's #report-copyminters channel or info@teia.art. Full text: [Core Values, Code of Conduct, Terms and Conditions](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions).`,
  },
  {
    id: 'core-values-summary',
    topic: 'Teia Core Values (Summary)',
    text: `Teia is an open, community-owned platform built on the values of Inclusivity, Respect, Community/Solidarity, Decentralization, Simplicity and Accessibility, Sustainability, and Creativity. It aims to be accessible to all artists and collectors regardless of background, favors shared ownership and open voting over gatekeeping, and seeks simple, low-barrier participation (e.g. anonymous accounts) alongside sustainable, decentralized storage for minted content. Full text: [Core Values](https://github.com/teia-community/teia-docs/wiki/Core-Values-Code-of-Conduct-Terms-and-Conditions#core-values).`,
  },
]
