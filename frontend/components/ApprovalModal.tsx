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
      type: "approve",
      sessionId: pendingApproval.sessionId,
      approved: false,
    });
    clearApproval();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-xl max-w-lg w-full border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Approve Execution</h2>
          </div>
          <button
            onClick={handleReject}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-gray-300 text-sm">
            The agent swarm has finished planning. Review the execution plan
            below:
          </p>

          <div className="bg-gray-950 rounded-lg p-4 space-y-3">
            {pendingApproval.plan.agents &&
              pendingApproval.plan.agents.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wider">
                    Agents Involved
                  </span>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {pendingApproval.plan.agents.map((agent) => (
                      <span
                        key={agent}
                        className="px-2 py-1 bg-gray-800 rounded text-sm font-mono"
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
                  <span className="text-gray-400 text-xs uppercase tracking-wider">
                    Actions
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {pendingApproval.plan.actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-400 mt-0.5">→</span>
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
                <span className="text-gray-400 text-xs uppercase tracking-wider">
                  Filecoin Proofs
                </span>
                {pendingApproval.plan.proofs.map((proof, i) => (
                  <a
                    key={i}
                    href={`https://gateway.lighthouse.storage/ipfs/${proof.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:underline text-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {proof.label}: {proof.cid.slice(0, 20)}...
                  </a>
                ))}
              </div>
            )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-gray-800">
          <button
            onClick={handleReject}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
