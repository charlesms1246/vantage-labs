"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

export default function RecursiveChat({ chatMode, setChatMode }: { chatMode: 'STANDARD' | 'RECURSIVE', setChatMode: (mode: 'STANDARD' | 'RECURSIVE') => void }) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Chat Mode</CardTitle>
                <CardDescription>
                    Choose how AI agents communicate with each other
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Select value={chatMode} onValueChange={setChatMode}>
                    <SelectTrigger className="w-full" defaultValue={"STANDARD"}>
                        <SelectValue placeholder="Select chat mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="STANDARD">
                            Standard Chat
                            <span className="block text-xs text-muted-foreground">
                                Direct communication between you and the agents
                            </span>
                        </SelectItem>
                        <SelectItem value="RECURSIVE">
                            Recursive Chat
                            <span className="block text-xs text-muted-foreground">
                                Agents discuss with each other without a human in the loop
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
    )
}
