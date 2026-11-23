import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import type { JoinResponse, SocialResponse } from "@et/core/api-types";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { CodeCard } from "@/screens/social/CodeCard";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/ui";
import { ask } from "@/ui/confirm";
import { SectionTitle } from "@/ui/form";
import { Empty, List, ListRow, Notice } from "@/ui/list";

/** Friends and clubs: join with a code, share yours, and the lists. The website's Friends page. */
export default function Friends() {
  const me = useMe();
  const q = useQuery({ queryKey: ["social"], queryFn: () => api<SocialResponse>("/social") });
  const act = useAction([["social"], ["leaderboards"]]);
  const [code, setCode] = useState("");
  const [clubName, setClubName] = useState<string | null>(null);
  const data = q.data;

  async function resetCode() {
    if (await ask("Make a new friend code?", "The old one stops working. Your current friends stay friends.", "New code"))
      void act.run(() => api("/social/code/reset", { body: {} }));
  }
  async function remove(sub: string, name: string) {
    if (await ask(`Remove ${name}?`, "You'll stop seeing each other on your Friends boards.", "Remove", true))
      void act.run(() => api(`/friends/${sub}`, { method: "DELETE" }));
  }

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Compare PBs with people you know.">Friends</Title>
      {me.data?.profile.share === "off" && (
        <Notice>
          <Body>Your PBs are hidden from everyone, friends and clubs included.</Body>
          <Button title="Change who sees them in Settings" variant="link" onPress={() => router.navigate("/settings")} />
        </Notice>
      )}
      <ErrorText>{act.error ?? q.error?.message}</ErrorText>
      {act.message ? <Body muted style={{ marginBottom: 12 }}>{act.message}</Body> : null}

      <Card>
        <SectionTitle>Add a friend or join a club</SectionTitle>
        <Field
          label="Code someone gave you"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="ABCD-EFGH-JKMN-PQRS"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
        />
        <Button
          title="Add"
          disabled={!code.trim()}
          loading={act.pending}
          onPress={async () => {
            const r = await act.run(() => api<JoinResponse>("/social/join", { body: { code } }), (r) => r.message);
            if (r) setCode("");
          }}
        />
      </Card>

      {data && (
        <Card>
          <SectionTitle>Your friend code</SectionTitle>
          <Body muted>Anyone who enters it becomes your friend, and you both see each other on your Friends boards.</Body>
          <CodeCard code={data.friendCode} shareText="Add me as a friend on Exercise Tracker with my code" onReset={resetCode} />
        </Card>
      )}

      <SectionTitle>{`Friends${data ? `  ${data.friends.length}` : ""}`}</SectionTitle>
      {data && data.friends.length === 0 ? (
        <Empty>No friends yet. Send your code, or enter theirs above.</Empty>
      ) : data ? (
        <List>
          {data.friends.map((f, i) => (
            <ListRow
              key={f.sub}
              first={i === 0}
              title={f.displayName}
              subtitle={`Friends since ${format(parseISO(f.since), "MMM d, yyyy")}`}
              right={<Button title="Remove" variant="link" onPress={() => void remove(f.sub, f.displayName)} />}
            />
          ))}
        </List>
      ) : null}

      <SectionTitle>{`Clubs${data ? `  ${data.clubs.length}` : ""}`}</SectionTitle>
      <Body muted style={{ marginBottom: 10 }}>Everyone in a club sees the same leaderboard. Join one with its code above.</Body>
      {data && data.clubs.length > 0 && (
        <List>
          {data.clubs.map(({ club, memberCount, isAdmin }, i) => (
            <ListRow
              key={club.id}
              first={i === 0}
              title={club.name}
              subtitle={`${memberCount} ${memberCount === 1 ? "member" : "members"}${isAdmin ? " · Admin" : ""}`}
              onPress={() => router.push({ pathname: "/club/[id]", params: { id: club.id } })}
            />
          ))}
        </List>
      )}
      {clubName == null ? (
        <Button title="+ Create a club" variant="secondary" onPress={() => setClubName("")} />
      ) : (
        <Card>
          <Field label="Club name" value={clubName} onChangeText={setClubName} placeholder="Derby team" maxLength={60} autoFocus />
          <Button
            title="Create"
            disabled={!clubName.trim()}
            loading={act.pending}
            onPress={async () => {
              const r = await act.run(() => api<{ club: { id: string } }>("/clubs", { body: { name: clubName } }));
              if (r) {
                setClubName(null);
                router.push({ pathname: "/club/[id]", params: { id: r.club.id } });
              }
            }}
          />
          <Button title="Cancel" variant="link" onPress={() => setClubName(null)} />
        </Card>
      )}
    </Screen>
  );
}
