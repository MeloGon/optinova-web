/** Un vendedor que el que llama (supervisor u admin+) puede administrar, con `list_team_vendors`. */
export interface TeamVendor {
  id: string;
  name: string;
  branch: string;
  canChangeDate: boolean;
}
