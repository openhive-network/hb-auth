import type { ITransaction, TRole, TSignature } from "@hiveio/wax";
import { ASignatureProvider } from "@hiveio/wax";

import { type OfflineClient, type OnlineClient } from "@hiveio/hb-auth";

// We do not extend from WaxError to avoid runtime dependencies, such as: /vite or /web - without it we can import only types
export class WaxHBAuthProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WaxHBAuthProviderError";
  }
}

/**
 * Wax transaction signature provider using the hb-auth.
 *
 * @note This provider does not support encryption. It is designed for signing transactions only.
 *
 * @example
 * ```
 * const provider = HBAuthProvider.for(hbAuthClient, "gtg", "posting");
 *
 * // Create a transaction using the Wax Hive chain instance
 * const tx = await chain.createTransaction();
 *
 * // Perform some operations, e.g. pushing operations...
 *
 * // Sign the transaction
 * await provider.signTransaction(tx);
 *
 * // broadcast
 * await chain.broadcast(tx);
 * ```
 */
class HBAuthProvider extends ASignatureProvider {
  readonly #client: OnlineClient | OfflineClient;
  public readonly username: string;
  public readonly role: TRole;

  private constructor(
    client: OnlineClient | OfflineClient,
    username: string,
    role: TRole
  ) {
    super();

    this.#client = client;
    this.username = username;
    this.role = role;
  }

  public static for(client: OnlineClient | OfflineClient, username: string, role: TRole): HBAuthProvider {
    if (role !== 'active' && role !== 'owner' && role !== 'posting')
      throw new WaxHBAuthProviderError(`Invalid role: ${role}`);

    return new HBAuthProvider(client, username, role);
  }

  /**
   * Generates signatures for given transaction using the hb-auth.
   *
   * @note This method does not support encryption. It is designed for signing transactions only.
   *
   * @param transaction The transaction to sign. The transaction should be created using the Wax Hive chain instance.
   * @throws on any error from the hb-auth invocation.
   */
  protected async generateSignatures(transaction: ITransaction): Promise<TSignature[]> {
    try {
      const signature = await this.#client.sign(this.username, transaction.sigDigest, this.role as 'active' | 'owner' | 'posting');

      return [signature];
    } catch (error) {
      throw new WaxHBAuthProviderError(`Failed to sign transaction using hb-auth: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}

export interface WaxHBAuthProviderCreator {
  /**
   * We assume you already called #initialize() on the client and client has imported the keys.
   *
   * @param client - The hb-auth client instance.
   * @param username - The username to sign the transaction with
   * @param role - The role to sign the transaction with
   */
  for(client: OnlineClient | OfflineClient, username: string, role: TRole): HBAuthProvider;
}

export default HBAuthProvider as WaxHBAuthProviderCreator;
