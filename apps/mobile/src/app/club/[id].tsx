import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { ClubResponse } from "@et/core/api-types";
import { useAction } from "@/api/action";
import { api } from "@/api/client";
import { useMe } from "@/api/queries";
import { useSession } from "@/auth/session";
import { CodeCard } from "@/screens/social/CodeCard";
import { Body, Button, Card, ErrorText, Field, Screen } from "@/ui";
import { ask } from "@/ui/confirm";
import { Row, SectionTitle } from "@/ui/form";
import { List, ListRow } from "@/ui/list";

/** One club: its leaderboard, invite code, members, and the admin's controls. */
export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signedIn = useSession().status === "signedIn";
  const me = useMe(signedIn).data?.user.sub;
  const q = useQuery({ queryKey: ["club", id], queryFn: () => api<ClubResponse>(`/clubs/${id}`), enabled: signedIn && !!id });
  const act = useAction([["club", id], ["social"], ["leaderboards"]]);
  const [name, setName] = useState<string | null>(null);
  if (!signedIn) return <Redirect href="/sign-in" />;
  const d = q.data;

  async function leave() {
    if (!d) return;
    const msg = !d.heir
      ? `You're the only member, so leaving deletes ${d.club.name}.`
      : d.isAdmin
        ? `${d.heir.displayName} will become the admin.`
        : "You can join again with its code.";
    if (!(await ask(`Leave ${d.club.name}?`, msg, "Leave", true))) return;
    if (await act.run(() => api(`/clubs/${id}/leave`, { body: {} }))) router.back();
  }
  async function del() {
    if (!d || !(await ask(`Delete ${d.club.name} for everyone?`, "Its board and invite code go away. This can't be undone.", "Delete club", true))) return;
    if (await act.run(() => api(`/clubs/${id}`, { method: "DELETE" }))) router.back();
  }
  async function makeAdmin(sub: string, who: string) {
    if (await ask(`Make ${who} the admin?`, `You'll stay a member, but only ${who} will be able to manage the club.`, "Make admin"))
      void act.run(() => api(`/clubs/${id}/members/${sub}/admin`, { body: {} }));
  }
  async function removeMember(sub: string, who: string) {
    if (await ask(`Remove ${who} from the club?`, "They can rejoin with the invite code unless you make a new one.", "Remove", true))
      void act.run(() => api(`/clubs/${id}/members/${sub}`, { method: "DELETE" }));
  }
  async function resetCode() {
    if (await ask("Make a new invite code?", "The old one stops working. Members stay in the club.", "New code"))
      void act.run(() => api(`/clubs/${id}/code/reset`, { body: {} }));
  }

  return (
    <>
      <Stack.Screen options={{ title: d?.club.name ?? "Club" }} />
      <Screen header onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
        <ErrorText>{act.error ?? q.error?.message}</ErrorText>
        {act.message ? <Body muted style={{ marginBottom: 12 }}>{act.message}</Body> : null}
        {d && (
          <>
            {name == null ? (
              <Row>
                <View style={{ flex: 1 }}>
                  <Button title="Club leaderboard" onPress={() => router.navigate({ pathname: "/leaderboards", params: { g: d.club.id } })} />
                </View>
                {d.isAdmin ? (
                  <View style={{ flex: 1 }}>
                    <Button title="Rename" variant="secondary" onPress={() => setName(d.club.name)} />
                  </View>
                ) : null}
              </Row>
            ) : (
              <Card>
                <Field label="Club name" value={name} onChangeText={setName} maxLength={60} autoFocus />
                <Button
                  title="Save"
                  disabled={!name.trim()}
                  loading={act.pending}
                  onPress={async () => {
                    if (await act.run(() => api(`/clubs/${id}`, { method: "PATCH", body: { name } }))) setName(null);
                  }}
                />
                <Button title="Cancel" variant="link" onPress={() => setName(null)} />
              </Card>
            )}
            <View style={{ height: 14 }} />
            <Card>
              <SectionTitle>Invite code</SectionTitle>
              <Body muted>Anyone with this code can join and see the club&apos;s board.</Body>
              <CodeCard
                code={d.club.code}
                shareText={`Join ${d.club.name} on Exercise Tracker with code`}
                busy={act.pending}
                onReset={d.isAdmin ? () => void resetCode() : undefined}
              />
            </Card>

            <SectionTitle>{`Members  ${d.members.length}`}</SectionTitle>
            <List>
              {d.members.map((m, i) => (
                <ListRow
                  key={m.sub}
                  first={i === 0}
                  title={m.displayName}
                  tag={m.sub === me ? "You" : undefined}
                  subtitle={`${m.sub === d.club.adminSub ? "Admin · " : ""}Joined ${format(parseISO(m.joinedAt), "MMM d, yyyy")}`}
                  right={
                    d.isAdmin && m.sub !== me ? (
                      <View>
                        <Button title="Make admin" variant="link" onPress={() => void makeAdmin(m.sub, m.displayName)} />
                        <Button title="Remove" variant="link" onPress={() => void removeMember(m.sub, m.displayName)} />
                      </View>
                    ) : undefined
                  }
                />
              ))}
            </List>

            <Button title="Leave club" variant="secondary" onPress={() => void leave()} loading={act.pending} />
            {d.isAdmin && <Button title="Delete club" variant="danger" onPress={() => void del()} />}
            {d.isAdmin && d.heir && (
              <Body muted style={{ marginTop: 10, fontSize: 13 }}>
                If you leave, admin passes to {d.heir.displayName}, the longest-standing member. Or hand it to someone with Make admin.
              </Body>
            )}
          </>
        )}
      </Screen>
    </>
  );
}
