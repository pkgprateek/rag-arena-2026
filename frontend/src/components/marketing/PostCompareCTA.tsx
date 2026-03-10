// RAG Arena 2026 — Post-Compare CTA

import { COPY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, ArrowRight } from "lucide-react";

export function PostCompareCTA() {
    return (
        <Card className="mx-auto max-w-2xl bg-gradient-to-br from-amber-500/[0.08] to-amber-600/[0.04] border-amber-500/20 overflow-hidden">
            <CardContent className="p-6 text-center space-y-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                    {COPY.ctaTitle}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
                    {COPY.ctaBody}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                        size="sm"
                        className="h-9 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs gap-2 shadow-lg shadow-amber-500/20"
                        asChild
                    >
                        <a href="#" target="_blank" rel="noopener noreferrer">
                            <Phone className="h-3.5 w-3.5" />
                            {COPY.ctaButton}
                            <ArrowRight className="h-3 w-3" />
                        </a>
                    </Button>
                </div>
                <p className="text-[10px] text-zinc-600">
                    No pricing. No commitment. Let's scope it.
                </p>
            </CardContent>
        </Card>
    );
}
