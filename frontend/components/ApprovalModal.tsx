"use client";

import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { X, Check, ExternalLink, Shield } from "lucide-react";

export function ApprovalModal() {
  const { pendingApproval, clearApproval } = useSession();
  const { sendMessage } = useWebSocket();
  const [isApproving, setIsApproving] = useState(false);

  if (!pendingApproval) return null;

  const handleApprove = () => {
    setIsApproving(true);
    sendMessage({
      type: "approve",
      sessionId: pendingApproval.sessionId,
      approved: true,
    });
    clearApproval();
  };

  const handleReject = () => {
    sendMessage({
      type: "reject",
      sessionId: pendingApproval.sessionId,
      approved: false,
    });
    clearApproval();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div data-testid="approval-modal" className="bg-card rounded-2xl max-w-lg w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Approve Execution</h2>
          </div>
          <button
            onClick={handleReject}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            The agent swarm has finished planning. Review the execution plan
            below:
          </p>

          <div className="bg-background rounded-lg p-4 space-y-3">
            {pendingApproval.plan.agents &&
              pendingApproval.plan.agents.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Agents Involved
                  </span>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {pendingApproval.plan.agents.map((agent) => (
                      <span
                        key={agent}
                        className="px-2 py-1 bg-accent rounded text-sm font-mono text-foreground"
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {pendingApproval.plan.actions &&
              pendingApproval.plan.actions.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Actions
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {pendingApproval.plan.actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-green-600 mt-0.5">→</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          {pendingApproval.plan.proofs &&
            pendingApproval.plan.proofs.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs uppercase tracking-wider">
                  Filecoin Proofs
                </span>
                {pendingApproval.plan.proofs.map((proof, i) => (
                  <a
                    key={i}
                    href={`https://gateway.lighthouse.storage/ipfs/${proof.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline text-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {proof.label}: {proof.cid.slice(0, 20)}...
                  </a>
                ))}
              </div>
            )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            onClick={handleReject}
            className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
