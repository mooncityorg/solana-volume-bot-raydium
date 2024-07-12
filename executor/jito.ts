
// Jito Bundling part

import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js"
import { BLOCKENGINE_URL, JITO_FEE, JITO_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from "../constants"
import base58 from "bs58"
import { SearcherClient, searcherClient } from "jito-ts/dist/sdk/block-engine/searcher"
import { Bundle } from "jito-ts/dist/sdk/block-engine/types"
import { isError } from "jito-ts/dist/sdk/block-engine/utils"

const solanaConnection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
})

export async function bundle(txs: VersionedTransaction[], keypair: Keypair) {
  try {
    const txNum = Math.ceil(txs.length / 3)
    let successNum = 0
    for (let i = 0; i < txNum; i++) {
      const upperIndex = (i + 1) * 3
      const downIndex = i * 3
      const newTxs = []
      for (let j = downIndex; j < upperIndex; j++) {
        if (txs[j]) newTxs.push(txs[j])
      }
      let success = await bull_dozer(newTxs, keypair)
      return success
    }
    if (successNum == txNum) return true
    else return false
  } catch (error) {
    return false
  }
}

export async function bull_dozer(txs: VersionedTransaction[], keypair: Keypair) {
  try {
    const bundleTransactionLimit = parseInt('4')
    const jitoKey = Keypair.fromSecretKey(base58.decode(JITO_KEY))
    const search = searcherClient(BLOCKENGINE_URL, jitoKey)

    await build_bundle(
      search,
      bundleTransactionLimit,
      txs,
      keypair
    )
    const bundle_result = await onBundleResult(search)
    return bundle_result
  } catch (error) {
    return 0
  }
}


async function build_bundle(
  search: SearcherClient,
  bundleTransactionLimit: number,
  txs: VersionedTransaction[],
  keypair: Keypair
) {
 
  const accounts = await search.getTipAccounts()
  const _tipAccount = accounts[Math.min(Math.floor(Math.random() * accounts.length), 3)]
  const tipAccount = new PublicKey(_tipAccount)

  const bund = new Bundle([], bundleTransactionLimit)
  const resp = await solanaConnection.getLatestBlockhash("processed")
  bund.addTransactions(...txs)

  let maybeBundle = bund.addTipTx(
    keypair,
    JITO_FEE,
    tipAccount,
    resp.blockhash
  )

  if (isError(maybeBundle)) {
    throw maybeBundle
  }
  try {
    await search.sendBundle(maybeBundle)
  } catch (e) { }
  return maybeBundle
}

export const onBundleResult = (c: SearcherClient): Promise<number> => {
  let first = 0
  let isResolved = false

  return new Promise((resolve) => {
    // Set a timeout to reject the promise if no bundle is accepted within 5 seconds
    setTimeout(() => {
      resolve(first)
      isResolved = true
    }, 30000)

    c.onBundleResult(
      (result: any) => {
        if (isResolved) return first
        // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
        const isAccepted = result.accepted
        const isRejected = result.rejected
        if (isResolved == false) {

          if (isAccepted) {
            // console.log(`bundle accepted, ID: ${result.bundleId}  | Slot: ${result.accepted!.slot}`)
            first += 1
            isResolved = true
            resolve(first) // Resolve with 'first' when a bundle is accepted
          }
          if (isRejected) {
            // Do not resolve or reject the promise here
          }
        }
      },
      (e: any) => {
        // Do not reject the promise here
      }
    )
  })
}























